import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TemplateRow {
  WorkoutID: string;
  WorkoutName: string;
  ExerciseID: string;
  ExcerciseName: string; // Typo in CSV
  WarmUpSet: string;
  WorkingSet: string;
  Reps: string;
  Weight: string;
  RIR: string;
}

interface TemplateData {
  workoutId: number;
  workoutName: string;
  exercises: Array<{
    exerciseId: number;
    exerciseName: string;
    order: number;
    sets: Array<{
      order: number;
      isWarmup: boolean;
      targetReps: number;
      targetWeight: number;
      targetRir: number;
    }>;
  }>;
}

function parseCsvLine(line: string): string[] {
  // Handle semicolon-separated values with potential commas in weight (e.g., 7,5)
  return line.split(';').map((val) => val.trim());
}

function parseFloat(value: string): number {
  // Handle German decimal notation (comma instead of dot)
  return Number(value.replace(',', '.'));
}

async function main() {
  console.log('🔄 Starting Workout Templates import...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, '..', '..', '..', 'Workout-Templates.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter((line) => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  // Parse CSV into structured data
  const templatesMap = new Map<number, TemplateData>();

  dataLines.forEach((line) => {
    const [workoutId, workoutName, exerciseId, exerciseName, warmUpSet, workingSet, reps, weight, rir] =
      parseCsvLine(line);

    const wId = parseInt(workoutId);
    const eId = parseInt(exerciseId);
    const isWarmup = warmUpSet.toLowerCase() === 'true';

    if (!templatesMap.has(wId)) {
      templatesMap.set(wId, {
        workoutId: wId,
        workoutName: workoutName,
        exercises: [],
      });
    }

    const template = templatesMap.get(wId)!;
    let exercise = template.exercises.find((e) => e.exerciseId === eId);

    if (!exercise) {
      exercise = {
        exerciseId: eId,
        exerciseName: exerciseName,
        order: template.exercises.length,
        sets: [],
      };
      template.exercises.push(exercise);
    }

    exercise.sets.push({
      order: exercise.sets.length,
      isWarmup: isWarmup,
      targetReps: parseInt(reps),
      targetWeight: parseFloat(weight),
      targetRir: parseInt(rir),
    });
  });

  console.log(`📋 Parsed ${templatesMap.size} workout templates from CSV\n`);

  // Import into database
  let successCount = 0;
  let errorCount = 0;

  for (const templateData of templatesMap.values()) {
    try {
      // Check if template already exists
      const existing = await prisma.workoutTemplate.findFirst({
        where: {
          name: templateData.workoutName,
          isCustom: false,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipping "${templateData.workoutName}" - already exists`);
        continue;
      }

      // Verify all exercises exist in database
      const exerciseIds = templateData.exercises.map((e) => e.exerciseId);
      const existingExercises = await prisma.exercise.findMany({
        where: {
          csvId: { in: exerciseIds },
          isCustom: false,
        },
      });

      if (existingExercises.length !== exerciseIds.length) {
        const foundIds = existingExercises.map((e) => e.csvId);
        const missingIds = exerciseIds.filter((id) => !foundIds.includes(id));
        console.log(
          `❌ Template "${templateData.workoutName}": Missing exercises with CSV IDs: ${missingIds.join(', ')}`,
        );
        errorCount++;
        continue;
      }

      // Create exercise ID map (csvId -> uuid)
      const exerciseIdMap = new Map<number, string>();
      existingExercises.forEach((ex) => {
        if (ex.csvId !== null) {
          exerciseIdMap.set(ex.csvId, ex.id);
        }
      });

      // Create workout template with exercises and sets
      await prisma.workoutTemplate.create({
        data: {
          name: templateData.workoutName,
          isCustom: false,
          userId: null,
          recommendedGymId: null,
          exercises: {
            create: templateData.exercises.map((ex) => ({
              exerciseId: exerciseIdMap.get(ex.exerciseId)!,
              order: ex.order,
              sets: {
                create: ex.sets,
              },
            })),
          },
        },
      });

      console.log(
        `✅ Imported: "${templateData.workoutName}" (${templateData.exercises.length} exercises, ${templateData.exercises.reduce((sum, e) => sum + e.sets.length, 0)} total sets)`,
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to import "${templateData.workoutName}":`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`✅ Successfully imported: ${successCount} templates`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} templates`);
  }
  console.log(`✅ Import completed!`);
}

main()
  .catch((error) => {
    console.error('Error during import:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
