/*
  Warnings:

  - The `description` column on the `stocks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[display_id]` on the table `items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `clients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `equipments` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `operation` on the `stocks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCAO', 'VENDA', 'QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO', 'AJUSTE_NEGATIVO');

-- CreateEnum
CREATE TYPE "StockOperation" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "display_id" SERIAL NOT NULL,
ADD COLUMN     "min_stock" DOUBLE PRECISION DEFAULT 0,
ALTER COLUMN "stock" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "stocks" DROP COLUMN "operation",
ADD COLUMN     "operation" "StockOperation" NOT NULL,
DROP COLUMN "description",
ADD COLUMN     "description" "StockReason";

-- CreateIndex
CREATE UNIQUE INDEX "items_display_id_key" ON "items"("display_id");
