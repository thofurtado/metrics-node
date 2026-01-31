-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "isEnterprise" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "items" ALTER COLUMN "display_id" DROP DEFAULT;
DROP SEQUENCE "items_display_id_seq";
