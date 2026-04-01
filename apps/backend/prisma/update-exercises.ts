import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from backend directory
config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Map CSV values to Prisma enum values
const muscleGroupMap: Record<string, string> = {
  'Abs': 'ABS',
  'Bauch': 'ABS',
  'Back': 'BACK',
  'Rücken': 'BACK',
  'Biceps': 'BICEPS',
  'Triceps': 'TRICEPS',
  'Trizeps': 'TRICEPS',
  'Chest': 'CHEST',
  'Brust': 'CHEST',
  'Shoulders': 'SHOULDERS',
  'Schultern': 'SHOULDERS',
  'Legs': 'LEGS',
  'Beine': 'LEGS',
};

const equipmentMap: Record<string, string> = {
  'Cable': 'CABLE',
  'Kabel': 'CABLE',
  'Machine': 'MACHINE',
  'Maschine': 'MACHINE',
  'Dumbbell': 'DUMBBELL',
  'Kurzhantel': 'DUMBBELL',
  'Barbell': 'BARBELL',
  'Langhantel': 'BARBELL',
  'Bodyweight': 'BODYWEIGHT',
  'Körpergewicht': 'BODYWEIGHT',
  'Smith Machine': 'SMITH_MACHINE',
  'Smith Maschine': 'SMITH_MACHINE',
  'EZ-Bar': 'EZ_BAR',
};

interface OldExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

interface NewExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
}

function parseBooleanField(value: string): boolean {
  return value.toLowerCase() === 'ja';
}

async function main() {
  console.log('🔄 Start updating exercises...');

  // Read old CSV file
  const oldCsvPath = path.join(__dirname, '../../../Exercises_old.csv');
  const newCsvPath = path.join(__dirname, '../../../Exercises.csv');

  if (!fs.existsSync(oldCsvPath)) {
    console.log('❌ Exercises_old.csv not found at:', oldCsvPath);
    return;
  }

  if (!fs.existsSync(newCsvPath)) {
    console.log('❌ Exercises.csv (new) not found at:', newCsvPath);
    return;
  }

  // Parse old CSV
  const oldCsvContent = fs.readFileSync(oldCsvPath, 'utf-8');
  const oldLines = oldCsvContent.split('\n').slice(1); // Skip header
  const oldExercises: Map<string, OldExercise> = new Map();

  for (const line of oldLines) {
    if (!line.trim()) continue;
    const [id, name, muscleGroup, equipment] = line.split(';').map((s) => s.trim());
    if (id && name) {
      oldExercises.set(id, { id, name, muscleGroup, equipment });
    }
  }

  console.log(`📋 Parsed ${oldExercises.size} old exercises`);

  // Parse new CSV
  const newCsvContent = fs.readFileSync(newCsvPath, 'utf-8');
  const newLines = newCsvContent.split('\n').slice(1); // Skip header
  const newExercises: Map<string, NewExercise> = new Map();

  for (const line of newLines) {
    if (!line.trim()) continue;
    const [id, name, muscleGroup, equipment, unilateral, bilateral, doubleWeight] = line
      .split(';')
      .map((s) => s.trim());

    if (id && name) {
      newExercises.set(id, {
        id,
        name,
        muscleGroup,
        equipment,
        isUnilateral: parseBooleanField(unilateral),
        isDoubleWeight: parseBooleanField(doubleWeight),
      });
    }
  }

  console.log(`📋 Parsed ${newExercises.size} new exercises`);

  // Update exercises in database
  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const [id, oldEx] of oldExercises) {
    const newEx = newExercises.get(id);
    if (!newEx) {
      console.log(`⚠️  No new exercise found for ID ${id} (${oldEx.name})`);
      notFoundCount++;
      continue;
    }

    try {
      // Find exercise by old name
      const existingExercise = await prisma.exercise.findFirst({
        where: {
          name: oldEx.name,
          isCustom: false,
        },
      });

      if (!existingExercise) {
        console.log(`⚠️  Exercise not found in DB: ${oldEx.name}`);
        notFoundCount++;
        continue;
      }

      // Update exercise
      await prisma.exercise.update({
        where: { id: existingExercise.id },
        data: {
          name: newEx.name,
          muscleGroup: muscleGroupMap[newEx.muscleGroup] as any,
          equipment: equipmentMap[newEx.equipment] as any,
          isUnilateral: newEx.isUnilateral,
          isDoubleWeight: newEx.isDoubleWeight,
        },
      });

      console.log(`✅ Updated: ${oldEx.name} → ${newEx.name} (unilateral: ${newEx.isUnilateral}, doubleWeight: ${newEx.isDoubleWeight})`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to update exercise: ${oldEx.name}`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Update Summary:');
  console.log(`✅ Successfully updated: ${successCount} exercises`);
  if (notFoundCount > 0) {
    console.log(`⚠️  Not found: ${notFoundCount} exercises`);
  }
  if (errorCount > 0) {
    console.log(`❌ Failed to update: ${errorCount} exercises`);
  }
  console.log('✅ Update completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error updating database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
