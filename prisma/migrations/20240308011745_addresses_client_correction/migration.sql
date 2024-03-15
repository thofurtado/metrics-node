/*
  Warnings:

  - Made the column `client_id` on table `addresses` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_client_id_fkey";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "client_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
