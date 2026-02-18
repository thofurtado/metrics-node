/*
  Warnings:

  - The values [SALARY_60,RATEIO_10,EXTRA_DAY,BENEFIT] on the enum `PayrollType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PayrollType_new" AS ENUM ('SALARIO_60', 'SALARIO_40', 'PONTUACAO_10', 'DIA_EXTRA', 'BENEFICIO', 'OTHER', 'VALE', 'ERRO', 'CONSUMACAO');
ALTER TABLE "payroll_entries" ALTER COLUMN "type" TYPE "PayrollType_new" USING ("type"::text::"PayrollType_new");
ALTER TYPE "PayrollType" RENAME TO "PayrollType_old";
ALTER TYPE "PayrollType_new" RENAME TO "PayrollType";
DROP TYPE "public"."PayrollType_old";
COMMIT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "registrationType" TEXT NOT NULL DEFAULT 'REGISTERED';
