import { createPrismaClient } from './prisma/create-prisma-client';

const prisma = createPrismaClient();

async function main() {
  const exerciseName = process.argv[2] || 'Kurzhantel Skull Crushers';
  
  const exercise = await prisma.exercise.findFirst({
    where: { name: exerciseName },
    include: {
      _count: {
        select: {
          exerciseLogs: true,
          blueprintExercises: true
        }
      }
    }
  });
  
  if (!exercise) {
    console.log('❌ Exercise not found:', exerciseName);
    return;
  }
  
  console.log('📋 Exercise:', exercise.name);
  console.log('   ID:', exercise.id);
  console.log('   Used in ExerciseLogs:', exercise._count.exerciseLogs);
  console.log('   Used in BlueprintExercises:', exercise._count.blueprintExercises);
  
  if (exercise._count.exerciseLogs === 0 && exercise._count.blueprintExercises === 0) {
    console.log('\n✅ Safe to delete - not used anywhere');
    
    // Delete the exercise
    await prisma.exercise.delete({
      where: { id: exercise.id }
    });
    console.log('✅ Deleted:', exerciseName);
  } else {
    console.log('\n⚠️  WARNING: Exercise is in use - cannot delete!');
  }
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
