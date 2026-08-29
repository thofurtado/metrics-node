-- CreateTable company_profiles if not exists
CREATE TABLE IF NOT EXISTS "company_profiles" (
    "id" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "companyName" TEXT,
    "document" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#FF5722',
    "secondaryColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "backgroundColor" TEXT NOT NULL DEFAULT '#F9F9F9',
    "whatsappNumber" TEXT NOT NULL,
    "street" TEXT,
    "number" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipcode" TEXT,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryTimeMin" INTEGER NOT NULL DEFAULT 30,
    "deliveryTimeMax" INTEGER NOT NULL DEFAULT 60,
    "isOpenManual" BOOLEAN NOT NULL DEFAULT true,
    "availableNeighborhoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliverySectors" JSONB DEFAULT '[]'::jsonb,
    "ifoodMerchantId" TEXT,
    "anotaAiApiKey" TEXT,
    "pixKey" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable business_hours if not exists
CREATE TABLE IF NOT EXISTS "business_hours" (
    "id" TEXT NOT NULL,
    "company_profile_id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_hours_company_profile_id_fkey'
    ) THEN
        ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "availableNeighborhoods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "deliverySectors" JSONB DEFAULT '[]'::jsonb;
