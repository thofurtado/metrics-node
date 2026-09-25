-- Fase 2 da sincronia (aprovada pelo Thomás em 25/09/2026). Só colunas novas; nada é apagado.
-- Idempotente (IF NOT EXISTS): pode rodar de novo sem erro.

-- Caixa: de que terminal é, quem criou (PDV ou web), o que o operador contou no fechamento e a quebra/sobra.
ALTER TABLE "cashier_sessions" ADD COLUMN IF NOT EXISTS "terminal_id" TEXT;
ALTER TABLE "cashier_sessions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "cashier_sessions" ADD COLUMN IF NOT EXISTS "counted" JSONB;
ALTER TABLE "cashier_sessions" ADD COLUMN IF NOT EXISTS "closing_difference" DOUBLE PRECISION;

-- Lançamento do caixa: de qual venda veio (antes só pelo texto "Balcao - Pedido #1f9408ee").
ALTER TABLE "cashier_entries" ADD COLUMN IF NOT EXISTS "sale_id" TEXT;
CREATE INDEX IF NOT EXISTS "cashier_entries_sale_id_idx" ON "cashier_entries"("sale_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cashier_entries_sale_id_fkey') THEN
    ALTER TABLE "cashier_entries" ADD CONSTRAINT "cashier_entries_sale_id_fkey"
      FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Venda: origem (Balcao, Mesa, Delivery…), qual mesa/comanda, frete, taxa de serviço e couvert.
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "origin" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "origin_identifier" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "delivery_fee" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "service_fee" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "cover_charge" DOUBLE PRECISION DEFAULT 0;

-- Movimento de estoque: qual item vendido gerou a baixa (estorno do cancelamento e conferência dependem disso).
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "sale_item_id" TEXT;
CREATE INDEX IF NOT EXISTS "stocks_sale_item_id_idx" ON "stocks"("sale_item_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stocks_sale_item_id_fkey') THEN
    ALTER TABLE "stocks" ADD CONSTRAINT "stocks_sale_item_id_fkey"
      FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Preenche o que já existe (só onde está vazio):
-- caixa que recebeu lançamento do PDV é caixa do PDV;
UPDATE "cashier_sessions" s SET "source" = 'PDV'
WHERE s."source" = 'WEB'
  AND (s."period" = 'Caixa PDV'
       OR EXISTS (SELECT 1 FROM "cashier_entries" e WHERE e."cashier_session_id" = s."id" AND e."source" = 'PDV'));

-- lançamento de venda do PDV aponta a venda do mesmo caixa cujo código aparece no texto;
UPDATE "cashier_entries" e SET "sale_id" = s."id"
FROM "sales" s
WHERE e."sale_id" IS NULL
  AND e."type" = 'SALE' AND e."source" = 'PDV'
  AND e."cashier_session_id" = s."cashier_session_id"
  AND e."identification" LIKE '%Pedido #' || substr(s."id", 1, 8) || '%';

-- a origem da venda é o começo do texto do lançamento ("Balcao - Pedido #…").
UPDATE "sales" s SET "origin" = split_part(e."identification", ' - Pedido #', 1)
FROM "cashier_entries" e
WHERE s."origin" IS NULL AND e."sale_id" = s."id" AND e."identification" LIKE '% - Pedido #%';
