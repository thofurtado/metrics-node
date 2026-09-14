ALTER TABLE "company_profiles"
  ADD COLUMN IF NOT EXISTS "ifoodAccessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "ifoodRefreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "ifoodTokenExpiresAt" TIMESTAMP(3);
