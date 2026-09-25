-- Deixa o que as migrations criam igual ao schema.prisma (25/09/2026). Só acrescenta; idempotente.
-- Nos bancos que passaram pelo "db push" forçado de 25/09, a única mudança real é recriar os 5 índices do financeiro
-- que ele apagou. O resto só age em banco montado pelas migrations sem aquele push (ex.: cliente novo).

-- 1) Índices do financeiro: criados em 20260904130000, nunca declarados no schema, apagados pelo push forçado.
CREATE INDEX IF NOT EXISTS "transactions_data_vencimento_idx" ON "transactions"("data_vencimento");
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions"("account_id");
CREATE INDEX IF NOT EXISTS "transactions_sector_id_idx" ON "transactions"("sector_id");
CREATE INDEX IF NOT EXISTS "transactions_supplier_id_idx" ON "transactions"("supplier_id");
CREATE INDEX IF NOT EXISTS "transactions_cashier_session_id_idx" ON "transactions"("cashier_session_id");

-- 2) Venda a prazo do funcionário: no schema desde 16/09 (v2.6.39) sem migration; cliente novo nascia sem as colunas.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "allow_term_sales" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "term_credit_limit" DECIMAL(65,30) DEFAULT 0;

-- 3) Nome padrão do caixa (só o valor padrão de caixas novos; não mexe em caixa existente).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'cashier_sessions' AND column_name = 'period'
               AND column_default IS DISTINCT FROM '''Caixa 01''::text') THEN
    ALTER TABLE "cashier_sessions" ALTER COLUMN "period" SET DEFAULT 'Caixa 01';
  END IF;
END $$;

-- 4) Textos de pedidos sem limite de tamanho (varchar(n) -> text, sem perda). Só nas colunas que ainda têm limite.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = current_schema() AND data_type = 'character varying'
             AND ((table_name = 'pedidos' AND column_name IN ('origem', 'status', 'motivo_cancelamento', 'cpf_na_nota',
                    'status_delivery', 'entregador', 'observacao', 'chave_nfce', 'status_contingencia'))
               OR (table_name = 'pedido_itens' AND column_name IN ('observacao', 'status_cozinha')))
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DATA TYPE TEXT', c.table_name, c.column_name);
  END LOOP;
END $$;

-- 5) Índice único com o nome cortado pelo Postgres (63 letras) passa a ter o nome que o Prisma espera.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'supplier_product_mappings_supplier_cnpj_supplier_product_code_k')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'supplier_product_mappings_supplier_cnpj_supplier_product_co_key') THEN
    ALTER INDEX "supplier_product_mappings_supplier_cnpj_supplier_product_code_k"
      RENAME TO "supplier_product_mappings_supplier_cnpj_supplier_product_co_key";
  END IF;
END $$;

-- Fica de fora de propósito: a tabela "SaaSIntegrationConfig" que a migration 20260914133000 cria no banco do cliente
-- (cópia sem uso; a de verdade fica no banco master). Nada aqui apaga; a sincronização só a lista como "mantida".
