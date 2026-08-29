-- CreateTable pedidos
CREATE TABLE IF NOT EXISTS "pedidos" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "display_id" INTEGER NOT NULL,
    "numero_diario" INTEGER,
    "origem" VARCHAR(20) NOT NULL DEFAULT 'Delivery',
    "atendimento_id" INTEGER,
    "cliente_id" TEXT,
    "endereco_entrega_id" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "desconto_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_frete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_servico" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_tributos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_final" DOUBLE PRECISION NOT NULL,
    "valor_troco" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data_abertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fechamento" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Aberto',
    "motivo_cancelamento" VARCHAR(200),
    "cpf_na_nota" VARCHAR(20),
    "status_delivery" VARCHAR(30) DEFAULT 'Pendente',
    "entregador" VARCHAR(100),
    "observacao" VARCHAR(500),
    "hora_saida_rota" TIMESTAMP(3),
    "caixa_id" TEXT,
    "usuario_id" TEXT,
    "chave_nfce" VARCHAR(50),
    "qrcode_nfce" TEXT,
    "is_contingencia" BOOLEAN NOT NULL DEFAULT false,
    "status_contingencia" VARCHAR(20),
    "xml_contingencia" TEXT,
    "data_envio_contingencia" TIMESTAMP(3),
    "sincronizado_web" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable pedido_itens
CREATE TABLE IF NOT EXISTS "pedido_itens" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "produto_id" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "valor_unitario" DOUBLE PRECISION NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor_total" DOUBLE PRECISION NOT NULL,
    "valor_tributos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cobra_servico" BOOLEAN NOT NULL DEFAULT true,
    "observacao" VARCHAR(500),
    "complementos_json" TEXT,
    "status_cozinha" VARCHAR(20) NOT NULL DEFAULT 'Pendente',
    "hora_inicio_preparo" TIMESTAMP(3),

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pedido_itens_pedido_id_fkey'
    ) THEN
        ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
