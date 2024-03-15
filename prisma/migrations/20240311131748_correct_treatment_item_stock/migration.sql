-- DropForeignKey
ALTER TABLE "treatmentItens" DROP CONSTRAINT "treatmentItens_stock_id_fkey";

-- AlterTable
ALTER TABLE "treatmentItens" ALTER COLUMN "stock_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "treatmentItens" ADD CONSTRAINT "treatmentItens_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
