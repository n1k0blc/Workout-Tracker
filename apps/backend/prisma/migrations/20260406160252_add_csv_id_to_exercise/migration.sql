/*
  Warnings:

  - A unique constraint covering the columns `[csvId]` on the table `Exercise` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "csvId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_csvId_key" ON "Exercise"("csvId");
