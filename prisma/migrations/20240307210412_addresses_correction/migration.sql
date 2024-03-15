-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_client_id_fkey";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
