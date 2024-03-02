/*
  Warnings:

  - You are about to alter the column `goal` on the `accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `cost` on the `items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `price` on the `items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `paymentEntrys` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `cccurrences` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `payments` table. All the data in the column will be lost.
  - You are about to alter the column `budget` on the `sectors` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `quantity` on the `stocks` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `quantity` on the `treatmentItens` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `discount` on the `treatmentItens` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `treatments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - Added the required column `balance` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entry` to the `equipments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stock` to the `items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occurrences` to the `paymentEntrys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `is_credit` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "treatments" DROP CONSTRAINT "treatments_client_id_fkey";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "goal" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "entry" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "stock" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "cost" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "paymentEntrys" ADD COLUMN     "occurrences" INTEGER NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "cccurrences",
DROP COLUMN "condition",
ADD COLUMN     "is_credit" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "sectors" ALTER COLUMN "budget" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "stocks" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "treatmentItens" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "discount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "treatments" ALTER COLUMN "contact" DROP NOT NULL,
ALTER COLUMN "client_id" DROP NOT NULL,
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
