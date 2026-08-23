import { PrismaClient } from '../generated/prisma';

async function backfillORMBenchmarks() {
  const prisma = new PrismaClient();
  
  console.log('🔄 Starting ORM Benchmark backfill...');
  
  // 1. Find all COMPLETED cycle workouts (Home Gym only for consistent equipment)
  const cycleWorkouts = await prisma.workout.findMany({
    where: {
      cycleId: { not: null },
      workoutDayId: { not: null },
      status: 'COMPLETED',
      homeGymId: { not: null }, // Only Home Gym workouts
    },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`📊 Found ${cycleWorkouts.length} completed cycle workouts`);

  // 2. Group by (cycleId, workoutDayId)
  const grouped = new Map<string, typeof cycleWorkouts>();
  
  for (const workout of cycleWorkouts) {
    const key = `${workout.cycleId}-${workout.workoutDayId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(workout);
  }

  console.log(`📦 Grouped into ${grouped.size} workout day groups`);

  let benchmarksCreated = 0;
  let benchmarksSkipped = 0;

  // 3. For each group, process first workout
  for (const [key, workouts] of grouped) {
    const firstWorkout = workouts[0]; // Already sorted by date asc
    
    console.log(`\n🔍 Processing first workout for ${key} (${firstWorkout.date})`);
    
    for (const exerciseLog of firstWorkout.exercises) {
      // 4. Calculate benchmark
      const workingSets = exerciseLog.sets.filter(s => s.setType === 'WORKING');
      
      if (workingSets.length === 0) {
        console.log(`  ⚠️  No working sets for ${exerciseLog.exercise.name}, skipping`);
        benchmarksSkipped++;
        continue;
      }
      
      const ormValues = workingSets.map(set => {
        let weight = set.weight;
        if (exerciseLog.exercise.isDoubleWeight) {
          weight *= 2;
        }
        
        const reps = set.reps;
        const rir = set.rir ?? 0;
        
        return weight * (1 + (reps + rir) / 30);
      });
      
      const benchmark = ormValues.reduce((a, b) => a + b, 0) / ormValues.length;
      
      // 5. Insert benchmark (upsert to handle re-runs)
      try {
        await prisma.exerciseBenchmark.upsert({
          where: {
            cycleId_workoutDayId_exerciseId: {
              cycleId: firstWorkout.cycleId!,
              workoutDayId: firstWorkout.workoutDayId!,
              exerciseId: exerciseLog.exerciseId,
            },
          },
          create: {
            cycleId: firstWorkout.cycleId!,
            workoutDayId: firstWorkout.workoutDayId!,
            exerciseId: exerciseLog.exerciseId,
            ormBenchmark: benchmark,
            setAtWorkoutId: firstWorkout.id,
          },
          update: {}, // Don't update if exists
        });
        
        console.log(`  ✅ Benchmark set: ${exerciseLog.exercise.name} = ${benchmark.toFixed(2)}kg ORM`);
        benchmarksCreated++;
      } catch (error) {
        console.error(`  ❌ Error creating benchmark for ${exerciseLog.exercise.name}:`, error);
      }
    }
  }
  
  console.log(`\n✅ Backfill completed!`);
  console.log(`📈 Benchmarks created: ${benchmarksCreated}`);
  console.log(`⏭️  Benchmarks skipped: ${benchmarksSkipped}`);
  
  await prisma.$disconnect();
}

backfillORMBenchmarks().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
