/*
  Warnings:

  - You are about to drop the column `barcode` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `cost` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `display_id` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `isItem` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `min_stock` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `items` table. All the data in the column will be lost.

  (Manual Edit: Data Migration Logic Added to prevent data loss)
*/

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE', 'SUPPLY');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "display_id" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" DOUBLE PRECISION DEFAULT 0,
    "min_stock" DOUBLE PRECISION DEFAULT 0,
    "barcode" TEXT,
    "ncm" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "display_id" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "estimated_time" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies" (
    "id" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "stock" DOUBLE PRECISION DEFAULT 0,
    "unit" TEXT,

    CONSTRAINT "supplies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_display_id_key" ON "products"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_display_id_key" ON "services"("display_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_id_fkey" FOREIGN KEY ("id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_id_fkey" FOREIGN KEY ("id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_id_fkey" FOREIGN KEY ("id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add Type first (so we can update it)
ALTER TABLE "items" ADD COLUMN "type" "ItemType" NOT NULL DEFAULT 'PRODUCT';

-- *** DATA MIGRATION SECTION ***

-- 1. Migrate Products
INSERT INTO "products" ("id", "display_id", "price", "stock", "min_stock", "barcode")
SELECT "id", "display_id", "price", "stock", "min_stock", "barcode"
FROM "items"
WHERE "isItem" = true;

-- 2. Migrate Services (Assuming anything not a product is a service)
INSERT INTO "services" ("id", "display_id", "price")
SELECT "id", "display_id", "price"
FROM "items"
WHERE "isItem" = false OR "isItem" IS NULL;

-- 3. Update Item Types
UPDATE "items" SET "type" = 'PRODUCT' WHERE "isItem" = true;
UPDATE "items" SET "type" = 'SERVICE' WHERE "isItem" = false OR "isItem" IS NULL;

-- *** END DATA MIGRATION ***

-- DropIndex
DROP INDEX "items_display_id_key";

-- AlterTable: Drop old columns
ALTER TABLE "items" DROP COLUMN "barcode",
DROP COLUMN "cost",
DROP COLUMN "display_id",
DROP COLUMN "isItem",
DROP COLUMN "min_stock",
DROP COLUMN "price",
DROP COLUMN "stock";
