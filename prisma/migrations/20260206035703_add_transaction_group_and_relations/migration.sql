-- AlterTable
ALTER TABLE "recurring_transactions" ADD COLUMN     "end_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transaction_group_id" TEXT;

-- CreateTable
CREATE TABLE "transaction_groups" (
    "id" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transaction_group_id_fkey" FOREIGN KEY ("transaction_group_id") REFERENCES "transaction_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
