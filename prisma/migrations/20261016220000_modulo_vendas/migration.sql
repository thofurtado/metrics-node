-- Módulo Vendas, etapas 2 e 3 (decisões D2, D3 e D11 do Thomás, 16/10/2026; _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md).
-- Idempotente: pode rodar de novo sem erro e não apaga nada. Só acrescenta.
--
-- 1. A venda guarda o número do pedido no PDV, a senha do dia e o cliente: o PDV já mandava (DisplayId, NumeroDiario,
--    ClienteUuid), a nuvem não guardava, e a lista "venda a venda" e o detalhe precisam deles. Vendas antigas ficam vazias
--    ("—" na web) até o PDV reenviar.
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "display_id" INTEGER;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "daily_number" INTEGER;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_client_id_fkey') THEN
    ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Índices das consultas novas (lista por período e por caixa, itens da venda, produtos vendidos, cancelamentos).
--    O PostgreSQL não cria índice sozinho nas chaves estrangeiras: sem eles, cada página da lista e cada relatório lê as
--    tabelas inteiras (Katatau: ~350 vendas e ~800 itens por dia).
CREATE INDEX IF NOT EXISTS "sales_created_at_idx" ON "sales"("created_at");
CREATE INDEX IF NOT EXISTS "sales_cashier_session_id_idx" ON "sales"("cashier_session_id");
CREATE INDEX IF NOT EXISTS "sales_client_id_idx" ON "sales"("client_id");
CREATE INDEX IF NOT EXISTS "sale_items_sale_id_idx" ON "sale_items"("sale_id");
CREATE INDEX IF NOT EXISTS "sale_items_product_id_idx" ON "sale_items"("product_id");
CREATE INDEX IF NOT EXISTS "cashier_entries_cashier_session_id_idx" ON "cashier_entries"("cashier_session_id");
CREATE INDEX IF NOT EXISTS "cancellation_audits_cancelled_at_idx" ON "cancellation_audits"("cancelled_at");
CREATE INDEX IF NOT EXISTS "cancellation_audits_sale_id_idx" ON "cancellation_audits"("sale_id");
