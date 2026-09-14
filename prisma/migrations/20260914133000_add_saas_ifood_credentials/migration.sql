CREATE TABLE IF NOT EXISTS "SaaSIntegrationConfig" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaaSIntegrationConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaaSIntegrationConfig_provider_key" UNIQUE ("provider")
);
