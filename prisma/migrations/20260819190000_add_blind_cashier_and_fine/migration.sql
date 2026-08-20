-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "blind_cashier_closure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "system_configs" ADD COLUMN IF NOT EXISTS "cashier_default_origin" TEXT NOT NULL DEFAULT 'Mesa';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fine" DOUBLE PRECISION DEFAULT 0;
