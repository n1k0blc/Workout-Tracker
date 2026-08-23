import { createPrismaClient } from './create-prisma-client';

const prisma = createPrismaClient();

async function main() {
  console.log('🔍 Exercise Database Verification\n');
  console.log('='.repeat(60));

  // Total exercises
  const totalExercises = await prisma.exercise.count();
  console.log(`\n📊 Total Exercises in DB: ${totalExercises}`);

  // Exercises with csvId
  const withCsvId = await prisma.exercise.count({
    where: { csvId: { not: null } },
  });
  console.log(`✅ Exercises with CSV ID: ${withCsvId}`);

  // Exercises without csvId
  const withoutCsvId = await prisma.exercise.count({
    where: { csvId: null },
  });
  console.log(`⚠️  Exercises without CSV ID: ${withoutCsvId}`);

  if (withoutCsvId > 0) {
    console.log('\n📋 Exercises without CSV ID:');
    const exercisesWithoutCsvId = await prisma.exercise.findMany({
      where: { csvId: null },
      select: { id: true, name: true, isCustom: true },
    });
    exercisesWithoutCsvId.forEach((ex) => {
      console.log(`   - ${ex.name} (Custom: ${ex.isCustom})`);
    });
  }

  // Custom vs System exercises
  const customExercises = await prisma.exercise.count({
    where: { isCustom: true },
  });
  const systemExercises = await prisma.exercise.count({
    where: { isCustom: false },
  });
  console.log(`\n📦 System Exercises: ${systemExercises}`);
  console.log(`👤 Custom Exercises: ${customExercises}`);

  // Unilateral exercises
  const unilateralExercises = await prisma.exercise.count({
    where: { isUnilateral: true },
  });
  console.log(`\n💪 Unilateral Exercises: ${unilateralExercises}`);

  // Double weight exercises
  const doubleWeightExercises = await prisma.exercise.count({
    where: { isDoubleWeight: true },
  });
  console.log(`⚖️  Double Weight Exercises: ${doubleWeightExercises}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification completed!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
