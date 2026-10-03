-- CreateTable
CREATE TABLE "FoodTranslation" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FoodTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodPortionTranslation" (
    "id" TEXT NOT NULL,
    "portionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "FoodPortionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodTranslation_foodId_locale_key" ON "FoodTranslation"("foodId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortionTranslation_portionId_locale_key" ON "FoodPortionTranslation"("portionId", "locale");

-- AddForeignKey
ALTER TABLE "FoodTranslation" ADD CONSTRAINT "FoodTranslation_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPortionTranslation" ADD CONSTRAINT "FoodPortionTranslation_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "FoodPortion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the seed foods' existing names and portion labels are German. English rows
-- arrive with the seed.
INSERT INTO "FoodTranslation" ("id", "foodId", "locale", "name")
SELECT gen_random_uuid()::text, "id", 'DE', "name" FROM "Food" WHERE "source" = 'SEED';

INSERT INTO "FoodPortionTranslation" ("id", "portionId", "locale", "label")
SELECT gen_random_uuid()::text, p."id", 'DE', p."label"
FROM "FoodPortion" p JOIN "Food" f ON f."id" = p."foodId" WHERE f."source" = 'SEED';
