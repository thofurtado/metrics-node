-- Integrações do cliente com serviços de fora (25/09/2026): tabela nova, nada existente é alterado.
-- IBPT (De Olho no Imposto) guarda o token e o CNPJ da empresa; 99Food guarda o id da loja.
-- Idempotente: pode rodar de novo sem erro.
CREATE TABLE IF NOT EXISTS "tenant_integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_integrations_provider_key" ON "tenant_integrations"("provider");
