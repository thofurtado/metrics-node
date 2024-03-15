/*
  Warnings:

  - You are about to drop the column `opening` on the `treatments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "treatments" DROP COLUMN "opening",
ADD COLUMN     "ending_date" TIMESTAMP(3),
ADD COLUMN     "opening_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
