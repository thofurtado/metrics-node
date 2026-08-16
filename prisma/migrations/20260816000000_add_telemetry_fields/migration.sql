-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_client_id_fkey";

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN "last_telemetry" JSONB,
ADD COLUMN "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_seen_at" TIMESTAMP(3),
ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
