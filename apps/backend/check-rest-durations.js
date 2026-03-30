const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRestDurations() {
  console.log('\n=== SetLogs mit actualRestDuration ===');
  const setLogs = await prisma.setLog.findMany({
    where: {
      actualRestDuration: { not: null }
    },
    include: {
      exerciseLog: {
        include: {
          exercise: { select: { name: true } },
          workout: { 
            select: { 
              date: true,
              workoutDayId: true
            } 
          }
        }
      }
    },
    orderBy: { completedAt: 'desc' },
    take: 10
  });

  if (setLogs.length === 0) {
    console.log('❌ Keine SetLogs mit actualRestDuration gefunden');
  } else {
    setLogs.forEach(log => {
      console.log(`\n📊 Satz ${log.setNumber} - ${log.exerciseLog.exercise.name}`);
      console.log(`   Tatsächliche Pause: ${log.actualRestDuration}s`);
      console.log(`   Workout: ${log.exerciseLog.workout.date}`);
      console.log(`   Workout Day ID: ${log.exerciseLog.workout.workoutDayId}`);
    });
  }

  console.log('\n\n=== BlueprintSets mit restAfterSet ===');
  const blueprintSets = await prisma.blueprintSet.findMany({
    include: {
      blueprintExercise: {
        include: {
          exercise: { select: { name: true } },
          blueprint: {
            include: {
              workoutDay: {
                select: { 
                  name: true,
                  id: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { order: 'asc' },
    take: 20
  });

  const groupedByWorkoutDay = blueprintSets.reduce((acc, set) => {
    const workoutDayName = set.blueprintExercise.blueprint.workoutDay.name;
    const workoutDayId = set.blueprintExercise.blueprint.workoutDay.id;
    const key = `${workoutDayName} (${workoutDayId})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(set);
    return acc;
  }, {});

  Object.entries(groupedByWorkoutDay).forEach(([workoutDay, sets]) => {
    console.log(`\n\n🏋️ Workout Day: ${workoutDay}`);
    sets.forEach(set => {
      console.log(`   ${set.blueprintExercise.exercise.name} - Satz ${set.order}: ${set.restAfterSet}s Pause`);
    });
  });

  await prisma.$disconnect();
}

checkRestDurations().catch(console.error);
