import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from backend directory
config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Map German muscle group names to Prisma enum values
const muscleGroupMap: Record<string, string> = {
  'Bauch': 'ABDOMEN',
  'Latissimus': 'LATISSIMUS',
  'Trapez': 'TRAPEZIUS',
  'Unterer Rücken': 'LOWER_BACK',
  'Beinbeuger': 'HAMSTRINGS',
  'Glutes': 'GLUTES',
  'Schultern': 'SHOULDERS',
  'Bizeps': 'BICEPS',
  'Brust': 'CHEST',
  'Quadrizeps': 'QUADRICEPS',
  'Waden': 'CALVES',
  'Trizeps': 'TRICEPS',
  // Legacy values for backwards compatibility
  'Abs': 'ABDOMEN',
  'Back': 'LATISSIMUS',
  'Triceps': 'TRICEPS',
  'Chest': 'CHEST',
  'Shoulders': 'SHOULDERS',
  'Legs': 'QUADRICEPS',
};

const equipmentMap: Record<string, string> = {
  'Kabel': 'CABLE',
  'Maschine': 'MACHINE',
  'Kurzhantel': 'DUMBBELL',
  'Langhantel': 'BARBELL',
  'Körpergewicht': 'BODYWEIGHT',
  'Smith Maschine': 'SMITH_MACHINE',
  'EZ-Bar': 'EZ_BAR',
  // English names for backwards compatibility
  'Cable': 'CABLE',
  'Machine': 'MACHINE',
  'Dumbbell': 'DUMBBELL',
  'Barbell': 'BARBELL',
  'Bodyweight': 'BODYWEIGHT',
  'Smith Machine': 'SMITH_MACHINE',
};

// Parse percentage string (e.g., "45%") to integer
function parsePercent(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace('%', '').trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

// Parse boolean string
function parseBoolean(value: string): boolean {
  const cleaned = value?.toLowerCase().trim();
  return cleaned === 'ja' || cleaned === 'yes' || cleaned === 'true';
}

async function main() {
  console.log('🌱 Start seeding exercises from Exercises_premium.csv...');

  // Read CSV file
  const csvPath = path.join(__dirname, '../../../Exercises_premium.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('❌ Exercises_premium.csv not found at:', csvPath);
    console.log('ℹ️  Please ensure Exercises_premium.csv is in the project root');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV (skip header)
  const lines = csvContent.split('\n').slice(1);
  const exercises = lines
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split(';').map((s) => s.trim());
      
      // CSV Format:
      // 0: ID, 1: Übung, 2: Muskelgruppe main, 
      // 3: Quadrizeps%, 4: Beinbeuger%, 5: Glutes%, 6: Waden%, 
      // 7: Schultern%, 8: Trizeps%, 9: Trapez%, 10: Latissimus%, 
      // 11: Bizeps%, 12: Brust%, 13: Bauch%, 14: Unterer Rücken%,
      // 15: Equipment, 16: Unilateral, 17: Bilateral, 18: Gewicht 2x
      
      return {
        csvId: parseInt(cols[0], 10),
        name: cols[1],
        muscleGroup: muscleGroupMap[cols[2]],
        quadricepsPercent: parsePercent(cols[3]),
        hamstringsPercent: parsePercent(cols[4]),
        glutesPercent: parsePercent(cols[5]),
        calvesPercent: parsePercent(cols[6]),
        shouldersPercent: parsePercent(cols[7]),
        tricepsPercent: parsePercent(cols[8]),
        trapeziusPercent: parsePercent(cols[9]),
        latissimusPercent: parsePercent(cols[10]),
        bicepsPercent: parsePercent(cols[11]),
        chestPercent: parsePercent(cols[12]),
        abdomenPercent: parsePercent(cols[13]),
        lowerBackPercent: parsePercent(cols[14]),
        equipment: equipmentMap[cols[15]],
        isUnilateral: parseBoolean(cols[16]),
        isDoubleWeight: parseBoolean(cols[18]),
      };
    })
    .filter((ex) => ex.muscleGroup && ex.equipment && ex.csvId); // Filter out invalid entries

  console.log(`📋 Parsed ${exercises.length} exercises from CSV`);

  // Validate percentages sum to 100
  const invalidExercises = exercises.filter((ex) => {
    const sum = ex.quadricepsPercent + ex.hamstringsPercent + ex.glutesPercent + 
                ex.calvesPercent + ex.shouldersPercent + ex.tricepsPercent + 
                ex.trapeziusPercent + ex.latissimusPercent + ex.bicepsPercent + 
                ex.chestPercent + ex.abdomenPercent + ex.lowerBackPercent;
    return sum !== 100;
  });

  if (invalidExercises.length > 0) {
    console.warn(`⚠️  Warning: ${invalidExercises.length} exercises have percentages that don't sum to 100%:`);
    invalidExercises.slice(0, 5).forEach((ex) => {
      const sum = ex.quadricepsPercent + ex.hamstringsPercent + ex.glutesPercent + 
                  ex.calvesPercent + ex.shouldersPercent + ex.tricepsPercent + 
                  ex.trapeziusPercent + ex.latissimusPercent + ex.bicepsPercent + 
                  ex.chestPercent + ex.abdomenPercent + ex.lowerBackPercent;
      console.warn(`  - ${ex.name} (ID: ${ex.csvId}): ${sum}%`);
    });
    if (invalidExercises.length > 5) {
      console.warn(`  ... and ${invalidExercises.length - 5} more`);
    }
  }

  // Insert exercises into database
  let successCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (const exercise of exercises) {
    try {
      // Use upsert with csvId as unique identifier
      const result = await prisma.exercise.upsert({
        where: {
          csvId: exercise.csvId,
        },
        update: {
          name: exercise.name,
          muscleGroup: exercise.muscleGroup as any,
          equipment: exercise.equipment as any,
          quadricepsPercent: exercise.quadricepsPercent,
          hamstringsPercent: exercise.hamstringsPercent,
          glutesPercent: exercise.glutesPercent,
          calvesPercent: exercise.calvesPercent,
          shouldersPercent: exercise.shouldersPercent,
          tricepsPercent: exercise.tricepsPercent,
          trapeziusPercent: exercise.trapeziusPercent,
          latissimusPercent: exercise.latissimusPercent,
          bicepsPercent: exercise.bicepsPercent,
          chestPercent: exercise.chestPercent,
          abdomenPercent: exercise.abdomenPercent,
          lowerBackPercent: exercise.lowerBackPercent,
          isUnilateral: exercise.isUnilateral,
          isDoubleWeight: exercise.isDoubleWeight,
        },
        create: {
          csvId: exercise.csvId,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup as any,
          equipment: exercise.equipment as any,
          quadricepsPercent: exercise.quadricepsPercent,
          hamstringsPercent: exercise.hamstringsPercent,
          glutesPercent: exercise.glutesPercent,
          calvesPercent: exercise.calvesPercent,
          shouldersPercent: exercise.shouldersPercent,
          tricepsPercent: exercise.tricepsPercent,
          trapeziusPercent: exercise.trapeziusPercent,
          latissimusPercent: exercise.latissimusPercent,
          bicepsPercent: exercise.bicepsPercent,
          chestPercent: exercise.chestPercent,
          abdomenPercent: exercise.abdomenPercent,
          lowerBackPercent: exercise.lowerBackPercent,
          isUnilateral: exercise.isUnilateral,
          isDoubleWeight: exercise.isDoubleWeight,
          isCustom: false,
          userId: null,
        },
      });
      
      if (result.csvId === exercise.csvId) {
        successCount++;
      } else {
        updateCount++;
      }
    } catch (error: any) {
      console.error(`❌ Failed to upsert exercise: ${exercise.name} (ID: ${exercise.csvId})`, error.message);
      errorCount++;
    }
  }

  console.log(`✅ Successfully seeded/updated ${successCount + updateCount} exercises`);
  console.log(`   - ${successCount} new exercises`);
  console.log(`   - ${updateCount} updated exercises`);
  if (errorCount > 0) {
    console.log(`❌ Failed to process ${errorCount} exercises`);
  }

  // Migrate custom exercises to have 100% on their main muscle group
  console.log('\n🔄 Migrating custom exercises...');
  
  const customExercises = await prisma.exercise.findMany({
    where: { isCustom: true },
  });

  let migratedCount = 0;
  for (const exercise of customExercises) {
    // Check if already migrated (any percentage > 0)
    if (
      exercise.quadricepsPercent > 0 || exercise.hamstringsPercent > 0 ||
      exercise.glutesPercent > 0 || exercise.calvesPercent > 0 ||
      exercise.shouldersPercent > 0 || exercise.tricepsPercent > 0 ||
      exercise.trapeziusPercent > 0 || exercise.latissimusPercent > 0 ||
      exercise.bicepsPercent > 0 || exercise.chestPercent > 0 ||
      exercise.abdomenPercent > 0 || exercise.lowerBackPercent > 0
    ) {
      continue; // Already migrated
    }

    // Set 100% on main muscle group
    const update: any = {};
    
    switch (exercise.muscleGroup) {
      case 'QUADRICEPS':
        update.quadricepsPercent = 100;
        break;
      case 'HAMSTRINGS':
        update.hamstringsPercent = 100;
        break;
      case 'GLUTES':
        update.glutesPercent = 100;
        break;
      case 'CALVES':
        update.calvesPercent = 100;
        break;
      case 'SHOULDERS':
        update.shouldersPercent = 100;
        break;
      case 'TRICEPS':
        update.tricepsPercent = 100;
        break;
      case 'TRAPEZIUS':
        update.trapeziusPercent = 100;
        break;
      case 'LATISSIMUS':
        update.latissimusPercent = 100;
        break;
      case 'BICEPS':
        update.bicepsPercent = 100;
        break;
      case 'CHEST':
        update.chestPercent = 100;
        break;
      case 'ABDOMEN':
        update.abdomenPercent = 100;
        break;
      case 'LOWER_BACK':
        update.lowerBackPercent = 100;
        break;
      // Legacy values
      case 'ABS':
        update.abdomenPercent = 100;
        update.muscleGroup = 'ABDOMEN';
        break;
      case 'BACK':
        update.latissimusPercent = 100;
        update.muscleGroup = 'LATISSIMUS';
        break;
      case 'LEGS':
        update.quadricepsPercent = 100;
        update.muscleGroup = 'QUADRICEPS';
        break;
    }

    if (Object.keys(update).length > 0) {
      await prisma.exercise.update({
        where: { id: exercise.id },
        data: update,
      });
      migratedCount++;
    }
  }

  console.log(`✅ Migrated ${migratedCount} custom exercises`);
  console.log('✅ Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

