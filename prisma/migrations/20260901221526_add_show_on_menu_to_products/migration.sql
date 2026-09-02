-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "show_on_menu" BOOLEAN NOT NULL DEFAULT true;
