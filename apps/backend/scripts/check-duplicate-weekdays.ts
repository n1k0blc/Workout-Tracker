/**
 * Read-only pre-migration check for `20260815120000_workout_day_unique_weekday_per_cycle`.
 *
 * That migration adds a unique index on WorkoutDay(cycleId, weekday) and will fail on any
 * cycle that already holds two days on the same weekday. Run this against the target
 * database *before* migrating -- finding out mid-deploy is the bad version of finding out.
 *
 * Writes nothing. Exits 0 when the database is clean, 1 when duplicates exist.
 *
 *   DATABASE_URL=... npm run check:duplicate-weekdays
 */
import { createPrismaClient } from '../prisma/create-prisma-client';
import { WEEKDAY_NAMES } from '../src/common/utils/weekday.util';

const prisma = createPrismaClient();

async function main() {
  const duplicates = await prisma.workoutDay.groupBy({
    by: ['cycleId', 'weekday'],
    _count: { _all: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (duplicates.length === 0) {
    console.log('✓ No cycle holds duplicate weekdays -- the migration will apply cleanly.');
    return;
  }

  console.log(`✗ ${duplicates.length} cycle/weekday pair(s) are duplicated. The migration will FAIL.\n`);

  for (const duplicate of duplicates) {
    const cycle = await prisma.workoutCycle.findUnique({
      where: { id: duplicate.cycleId },
      select: { name: true, status: true, user: { select: { email: true } } },
    });
    const days = await prisma.workoutDay.findMany({
      where: { cycleId: duplicate.cycleId, weekday: duplicate.weekday },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });

    console.log(
      `Cycle "${cycle?.name}" (${duplicate.cycleId}, ${cycle?.status}, ${cycle?.user?.email}) ` +
        `-- ${WEEKDAY_NAMES[duplicate.weekday]} claimed by ${days.length} days:`,
    );
    for (const day of days) {
      console.log(`  - order ${day.order}: "${day.name}" (${day.id})`);
    }
    console.log('');
  }

  console.log('Resolve each by moving one day to a free weekday before migrating.');
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
