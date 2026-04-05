import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating exercise flags...\n');

  // Update Kurzhantel Bankdrücken
  const dumbbellBench = await prisma.exercise.updateMany({
    where: {
      name: {
        contains: 'Kurzhantel Bankdrücken',
        mode: 'insensitive',
      },
      isCustom: false,
    },
    data: {
      isDoubleWeight: true,
    },
  });
  console.log(`✅ Updated Kurzhantel Bankdrücken: ${dumbbellBench.count} records`);

  // Update Unilateral Kabel Latzug
  const unilateralLat = await prisma.exercise.updateMany({
    where: {
      name: {
        contains: 'Unilateral Kabel Latzug',
        mode: 'insensitive',
      },
      isCustom: false,
    },
    data: {
      isUnilateral: true,
    },
  });
  console.log(`✅ Updated Unilateral Kabel Latzug: ${unilateralLat.count} records`);

  // Verify updates
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { name: { contains: 'Kurzhantel Bankdrücken', mode: 'insensitive' } },
        { name: { contains: 'Unilateral Kabel Latzug', mode: 'insensitive' } },
      ],
      isCustom: false,
    },
    select: {
      id: true,
      name: true,
      isUnilateral: true,
      isDoubleWeight: true,
    },
  });

  console.log('\n📊 Verification:');
  exercises.forEach((ex) => {
    console.log(`  - ${ex.name}: unilateral=${ex.isUnilateral}, doubleWeight=${ex.isDoubleWeight}`);
  });

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
