-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "isDoubleWeight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUnilateral" BOOLEAN NOT NULL DEFAULT false;
