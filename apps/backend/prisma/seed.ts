import { config } from 'dotenv';
import { PrismaClient } from '../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from backend directory
config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

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
      // 0: ID, 1: Übung, 2: Muskelgruppe main (unused -- distribution is the source of truth, §3.7),
      // 3: Quadrizeps%, 4: Beinbeuger%, 5: Glutes%, 6: Waden%,
      // 7: Schultern%, 8: Trizeps%, 9: Trapez%, 10: Latissimus%,
      // 11: Bizeps%, 12: Brust%, 13: Bauch%, 14: Unterer Rücken%,
      // 15: Equipment, 16: Unilateral, 17: Bilateral, 18: Gewicht 2x

      return {
        csvId: parseInt(cols[0], 10),
        name: cols[1],
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
    .filter((ex) => ex.equipment && ex.csvId); // Filter out invalid entries

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
