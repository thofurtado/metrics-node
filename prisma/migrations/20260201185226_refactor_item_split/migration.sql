/*
  Warnings:

  - You are about to drop the column `item_id` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `item_id` on the `treatment_items` table. All the data in the column will be lost.
  - You are about to drop the `items` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `supplies` table without a default value. This is not possible if the table is not empty.

*/

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_id_fkey";

-- DropForeignKey
ALTER TABLE "stocks" DROP CONSTRAINT "stocks_item_id_fkey";

-- DropForeignKey
ALTER TABLE "supplies" DROP CONSTRAINT "supplies_id_fkey";

-- DropForeignKey
ALTER TABLE "treatment_items" DROP CONSTRAINT "treatment_items_item_id_fkey";


-- 1. ADD COLUMNS AS NULLABLE FIRST
-- AlterTable Products
ALTER TABLE "products" ADD COLUMN "active" BOOLEAN DEFAULT true,
ADD COLUMN "category" TEXT,
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "description" TEXT,
ADD COLUMN "is_composite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "name" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable Services
ALTER TABLE "services" ADD COLUMN "active" BOOLEAN DEFAULT true,
ADD COLUMN "category" TEXT,
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "description" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable Supplies
ALTER TABLE "supplies" ADD COLUMN "active" BOOLEAN DEFAULT true,
ADD COLUMN "category" TEXT,
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "description" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- 2. MIGRATE DATA FROM ITEMS TO SPECIFIC TABLES
UPDATE "products" 
SET 
  "name" = i."name",
  "description" = i."description",
  "category" = i."category",
  "active" = i."active",
  "created_at" = i."created_at",
  "updated_at" = i."updated_at"
FROM "items" i
WHERE "products"."id" = i."id";

UPDATE "services" 
SET 
  "name" = i."name",
  "description" = i."description",
  "category" = i."category",
  "active" = i."active",
  "created_at" = i."created_at",
  "updated_at" = i."updated_at"
FROM "items" i
WHERE "services"."id" = i."id";

UPDATE "supplies" 
SET 
  "name" = i."name",
  "description" = i."description",
  "category" = i."category",
  "active" = i."active",
  "created_at" = i."created_at",
  "updated_at" = i."updated_at"
FROM "items" i
WHERE "supplies"."id" = i."id";


-- 3. MIGRATE REFERENCES (Stocks and Treatment Items)
-- Alter tables to add new FK columns (nullable)
ALTER TABLE "stocks"
ADD COLUMN "product_id" TEXT,
ADD COLUMN "supply_id" TEXT;

ALTER TABLE "treatment_items"
ADD COLUMN "product_id" TEXT,
ADD COLUMN "service_id" TEXT,
ADD COLUMN "supply_id" TEXT;

-- Update Stocks
UPDATE "stocks" SET "product_id" = "item_id" WHERE EXISTS (SELECT 1 FROM "products" WHERE "products"."id" = "stocks"."item_id");
UPDATE "stocks" SET "supply_id" = "item_id" WHERE EXISTS (SELECT 1 FROM "supplies" WHERE "supplies"."id" = "stocks"."item_id");

-- Update Treatment Items
UPDATE "treatment_items" SET "product_id" = "item_id" WHERE EXISTS (SELECT 1 FROM "products" WHERE "products"."id" = "treatment_items"."item_id");
UPDATE "treatment_items" SET "service_id" = "item_id" WHERE EXISTS (SELECT 1 FROM "services" WHERE "services"."id" = "treatment_items"."item_id");
UPDATE "treatment_items" SET "supply_id" = "item_id" WHERE EXISTS (SELECT 1 FROM "supplies" WHERE "supplies"."id" = "treatment_items"."item_id");


-- 4. ENFORCE NOT NULL CONSTRAINTS
-- Since we copied data, name should not be null for existing rows.
-- If there are orphaned rows (unlikely if constrained by FK before), they might be null. 
-- We can default them or delete them, but usually they match.
ALTER TABLE "products" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "services" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "supplies" ALTER COLUMN "name" SET NOT NULL;


-- 5. DROP OLD COLUMNS AND TABLES
ALTER TABLE "stocks" DROP COLUMN "item_id";
ALTER TABLE "treatment_items" DROP COLUMN "item_id";

DROP TABLE "items";

-- DropEnum
DROP TYPE "ItemType";

-- CreateTable Compositions
CREATE TABLE "compositions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supply_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "compositions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "compositions" ADD CONSTRAINT "compositions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compositions" ADD CONSTRAINT "compositions_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stocks" ADD CONSTRAINT "stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stocks" ADD CONSTRAINT "stocks_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
