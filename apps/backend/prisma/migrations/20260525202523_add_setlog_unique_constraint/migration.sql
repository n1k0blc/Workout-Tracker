/*
  Warnings:

  - A unique constraint covering the columns `[exerciseLogId,setNumber]` on the table `SetLog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SetLog_exerciseLogId_setNumber_key" ON "SetLog"("exerciseLogId", "setNumber");
