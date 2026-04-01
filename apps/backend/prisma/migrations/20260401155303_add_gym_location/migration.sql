-- CreateEnum
CREATE TYPE "GymLocation" AS ENUM ('HOME', 'OTHER');

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "gymLocation" "GymLocation" NOT NULL DEFAULT 'HOME';
