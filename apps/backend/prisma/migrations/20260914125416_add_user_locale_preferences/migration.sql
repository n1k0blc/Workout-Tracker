-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('DE', 'EN');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "FoodMarket" AS ENUM ('DE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "foodMarket" "FoodMarket" NOT NULL DEFAULT 'DE',
ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'DE',
ADD COLUMN     "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC';
