-- Estoque de verdade, etapa 4 do módulo Vendas e Estoque (decisões D5, D6, D8 e D12 do Thomás, 16/10/2026;
-- _claude-sync/relatorios/ESPEC-VENDAS-E-ESTOQUE.md). O histórico do produto é uma consulta na tabela de movimentos (stocks),
-- que já grava uma linha por movimento; faltava saber QUEM fez cada movimento, o SALDO logo depois dele, a nota de compra de
-- onde veio a entrada e o cancelamento de onde veio o estorno.
-- Idempotente: pode rodar de novo sem erro e não apaga nada. Todas as colunas são opcionais: os movimentos antigos ficam
-- vazios (a web calcula o saldo a partir do saldo atual e mostra "—" em quem fez).

-- Quem fez (usuário da web, quem cancelou no PDV; da venda, a web mostra o operador do caixa e o vendedor)
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "user_name" TEXT;
-- Saldo do produto/insumo logo depois do movimento (gravado na mesma transação que muda o saldo)
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "balance_after" DOUBLE PRECISION;
-- Texto do movimento ("Estorno da venda #123", motivo do ajuste, "Inventário")
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "note" TEXT;
-- NF-e de compra da entrada (chave de 44 números e o número da nota)
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "document_key" TEXT;
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "document_number" TEXT;
-- Cancelamento do PDV que gerou o estorno (cancellation_audits.id)
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "cancellation_id" TEXT;

-- Histórico de um produto/insumo (ordem de data) e o extrato do período
CREATE INDEX IF NOT EXISTS "stocks_product_id_created_at_idx" ON "stocks"("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "stocks_supply_id_created_at_idx" ON "stocks"("supply_id", "created_at");
CREATE INDEX IF NOT EXISTS "stocks_created_at_idx" ON "stocks"("created_at");
CREATE INDEX IF NOT EXISTS "stocks_document_key_idx" ON "stocks"("document_key");

-- Escolha do operador no cancelamento: ESTORNO (devolver ao estoque) ou DESPERDICIO. Antes só chegava e não era guardada;
-- a venda cancelada que não subiu antes precisa dela para registrar o desperdício (decisão de 28/09/2026).
ALTER TABLE "cancellation_audits" ADD COLUMN IF NOT EXISTS "stock_destination" TEXT;
CREATE INDEX IF NOT EXISTS "cancellation_audits_item_id_idx" ON "cancellation_audits"("item_id");
CREATE INDEX IF NOT EXISTS "cancellation_audits_sale_id_idx" ON "cancellation_audits"("sale_id");
