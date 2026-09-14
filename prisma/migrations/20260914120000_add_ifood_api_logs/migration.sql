CREATE TABLE "ifood_api_logs" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "order_id" TEXT,
    "local_order_id" INTEGER,
    "request_body" JSONB,
    "response_status" INTEGER,
    "response_body" JSONB,
    "duration_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifood_api_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ifood_api_logs_order_id_created_at_idx" ON "ifood_api_logs"("order_id", "created_at");
CREATE INDEX "ifood_api_logs_created_at_idx" ON "ifood_api_logs"("created_at");
