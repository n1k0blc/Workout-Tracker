/*
  Warnings:

  - You are about to drop the column `gymLocation` on the `Workout` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Workout" DROP COLUMN "gymLocation",
ADD COLUMN     "homeGymId" TEXT;

-- AlterTable
ALTER TABLE "WorkoutDay" ADD COLUMN     "plannedHomeGymId" TEXT;

-- CreateTable
CREATE TABLE "HomeGym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeGym_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HomeGym" ADD CONSTRAINT "HomeGym_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_plannedHomeGymId_fkey" FOREIGN KEY ("plannedHomeGymId") REFERENCES "HomeGym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_homeGymId_fkey" FOREIGN KEY ("homeGymId") REFERENCES "HomeGym"("id") ON DELETE SET NULL ON UPDATE CASCADE;
