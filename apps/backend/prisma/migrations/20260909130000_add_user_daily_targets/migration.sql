-- Tagesziele (#152): manual daily targets for kcal and the three macros (grams), stored on
-- the user. All four are nullable and independent -- "no targets set" is all four NULL, and
-- the day summary / dashboard card fall back to plain totals in that case. Manual only,
-- never derived from height/weight/age.

ALTER TABLE "User" ADD COLUMN "targetKcal" INTEGER;
ALTER TABLE "User" ADD COLUMN "targetCarbs" INTEGER;
ALTER TABLE "User" ADD COLUMN "targetProtein" INTEGER;
ALTER TABLE "User" ADD COLUMN "targetFat" INTEGER;
