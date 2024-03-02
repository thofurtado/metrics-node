-- CreateTable
CREATE TABLE "transfertransactions" (
    "id" TEXT NOT NULL,
    "destination_account_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,

    CONSTRAINT "transfertransactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transfertransactions" ADD CONSTRAINT "transfertransactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfertransactions" ADD CONSTRAINT "transfertransactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
