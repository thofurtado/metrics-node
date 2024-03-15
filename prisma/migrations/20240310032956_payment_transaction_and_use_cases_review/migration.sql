/*
  Warnings:

  - You are about to drop the column `is_credit` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `treatmentItens` table. All the data in the column will be lost.
  - Added the required column `in_sight` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `installment_limit` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stock_id` to the `treatmentItens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payments" DROP COLUMN "is_credit",
ADD COLUMN     "in_sight" BOOLEAN NOT NULL,
ADD COLUMN     "installment_limit" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "treatmentItens" DROP COLUMN "discount",
ADD COLUMN     "salesValue" DOUBLE PRECISION,
ADD COLUMN     "stock_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "installmentPayments" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,

    CONSTRAINT "installmentPayments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "treatmentItens" ADD CONSTRAINT "treatmentItens_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installmentPayments" ADD CONSTRAINT "installmentPayments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installmentPayments" ADD CONSTRAINT "installmentPayments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
