-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MuscleGroup" ADD VALUE 'ABDOMEN';
ALTER TYPE "MuscleGroup" ADD VALUE 'LATISSIMUS';
ALTER TYPE "MuscleGroup" ADD VALUE 'TRAPEZIUS';
ALTER TYPE "MuscleGroup" ADD VALUE 'LOWER_BACK';
ALTER TYPE "MuscleGroup" ADD VALUE 'HAMSTRINGS';
ALTER TYPE "MuscleGroup" ADD VALUE 'GLUTES';
ALTER TYPE "MuscleGroup" ADD VALUE 'QUADRICEPS';
ALTER TYPE "MuscleGroup" ADD VALUE 'CALVES';

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "abdomenPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bicepsPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calvesPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chestPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "glutesPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hamstringsPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "latissimusPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lowerBackPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quadricepsPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shouldersPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trapeziusPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tricepsPercent" INTEGER NOT NULL DEFAULT 0;
