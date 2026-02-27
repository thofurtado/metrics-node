-- DropIndex
DROP INDEX "addresses_client_id_key";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "is_main" BOOLEAN NOT NULL DEFAULT false;
