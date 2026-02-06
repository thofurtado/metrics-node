/*
  Warnings:

  - You are about to drop the `recurring_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_transactions_account_id_fkey";

-- DropForeignKey
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_transactions_sector_id_fkey";

-- DropForeignKey
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_transactions_supplier_id_fkey";

-- DropTable
DROP TABLE "recurring_transactions";

-- DropEnum
DROP TYPE "TransactionFrequency";
