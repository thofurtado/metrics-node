-- AlterTable: company_profiles
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "availableNeighborhoods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "deliverySectors" JSONB DEFAULT '[]'::jsonb;
