-- Vendas produto a produto, etapa 1 (decisões D3, D4, D11 e D12 do Thomás, 16/10/2026; _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md).
-- O PDV passa a mandar, em cada venda, o que faltava para o "venda por venda, produto por produto": o nome como foi vendido, o
-- vendedor, os complementos e a observação de cada item, e a NFC-e da venda (número, série, ambiente, chave e situação).
-- Idempotente: pode rodar de novo sem erro e não apaga nada. Todas as colunas são opcionais: as vendas antigas ficam vazias
-- (a web mostra "—") e o PDV antigo continua funcionando como antes (ele não manda os campos novos).

-- Item vendido: nome como foi vendido, vendedor (funcionário do RH quando é um, nome e número), complementos e observação livre.
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "sold_name" TEXT;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "seller_employee_id" TEXT;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "seller_name" TEXT;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "seller_number" INTEGER;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "complements" JSONB;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "note" TEXT;
CREATE INDEX IF NOT EXISTS "sale_items_seller_employee_id_idx" ON "sale_items"("seller_employee_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_seller_employee_id_fkey') THEN
    ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_seller_employee_id_fkey"
      FOREIGN KEY ("seller_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Venda: a NFC-e. nfce_changed_at = quando a nota mudou no PDV (uma mudança mais velha nunca passa por cima da mais nova).
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_status" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_number" INTEGER;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_series" INTEGER;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_environment" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_key" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_contingency" BOOLEAN;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_reason" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "nfce_changed_at" TIMESTAMP(3);
