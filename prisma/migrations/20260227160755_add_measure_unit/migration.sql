/*
  Warnings:

  - You are about to drop the column `benefits` on the `employees` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MeasureUnit" AS ENUM ('UNITARY', 'FRACTIONAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollType" ADD VALUE 'CESTA_BASICA';
ALTER TYPE "PayrollType" ADD VALUE 'VALE_TRANSPORTE';

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "benefits",
ADD COLUMN     "dailyRate" DECIMAL(65,30),
ADD COLUMN     "hasCestaBasica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRegistered" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "overtimeValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "transportAllowance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "salary" DROP NOT NULL,
ALTER COLUMN "salary" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "measureUnit" "MeasureUnit" NOT NULL DEFAULT 'UNITARY';

-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN     "cestaBasicaValue" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "discount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "interest" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalValue" DOUBLE PRECISION;
