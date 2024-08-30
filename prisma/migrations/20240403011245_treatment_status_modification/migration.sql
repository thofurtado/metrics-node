/*
  Warnings:

  - You are about to drop the column `finished` on the `treatments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "treatments" DROP COLUMN "finished",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';
