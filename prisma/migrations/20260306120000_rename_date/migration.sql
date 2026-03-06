ALTER TABLE "transactions" RENAME COLUMN "date" TO "data_vencimento";
ALTER TABLE "transactions" ADD COLUMN "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
