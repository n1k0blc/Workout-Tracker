import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExerciseMapping {
  id: number;
  germanName: string;
  englishName: string;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
}

async function parseCSV(filePath: string): Promise<string[][]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.map(line => line.split(';'));
}

async function main() {
  console.log('🚀 Starting Production Exercise Migration...\n');

  // Read both CSV files
  const oldCsvPath = path.join(__dirname, '../../../Exercises_old.csv');
  const newCsvPath = path.join(__dirname, '../../../Exercises.csv');

  console.log('📖 Reading CSV files...');
  const oldData = await parseCSV(oldCsvPath);
  const newData = await parseCSV(newCsvPath);

  // Remove headers
  oldData.shift(); // Remove header: ID;Excercise;Muscle Group;Equipment
  newData.shift(); // Remove header: ID;Übung;Muskelgruppe;Equipment;Unilateral;Bilateral;Gewicht 2x

  console.log(`✓ Found ${oldData.length} exercises in old CSV`);
  console.log(`✓ Found ${newData.length} exercises in new CSV\n`);

  // Create mapping
  const mappings: ExerciseMapping[] = newData.map((row, index) => {
    const id = parseInt(row[0]);
    const germanName = row[1];
    const englishName = oldData[index][1]; // Same index position
    const isUnilateral = row[4].toLowerCase() === 'ja';
    const isDoubleWeight = row[6].toLowerCase() === 'ja';

    return {
      id,
      germanName,
      englishName,
      isUnilateral,
      isDoubleWeight,
    };
  });

  console.log('📊 Migration Preview (first 5):');
  mappings.slice(0, 5).forEach(m => {
    console.log(`  ${m.id}. ${m.englishName} → ${m.germanName}`);
    console.log(`     Unilateral: ${m.isUnilateral}, DoubleWeight: ${m.isDoubleWeight}`);
  });
  console.log('  ...\n');

  // Get all exercises from database
  console.log('🔍 Fetching exercises from database...');
  const dbExercises = await prisma.exercise.findMany({
    where: {
      isCustom: false,
    },
    select: {
      id: true,
      name: true,
      isUnilateral: true,
      isDoubleWeight: true,
    },
  });
  console.log(`✓ Found ${dbExercises.length} exercises in database\n`);

  // Match and update exercises
  let updatedCount = 0;
  let notFoundCount = 0;
  const notFound: string[] = [];

  console.log('🔄 Updating exercises...');
  
  for (const mapping of mappings) {
    // Try to find by English name first
    let dbExercise = dbExercises.find(
      ex => ex.name.toLowerCase() === mapping.englishName.toLowerCase()
    );

    // If not found by English name, try German name (in case it was already updated)
    if (!dbExercise) {
      dbExercise = dbExercises.find(
        ex => ex.name.toLowerCase() === mapping.germanName.toLowerCase()
      );
    }

    if (dbExercise) {
      // Check if update is needed
      const needsUpdate = 
        dbExercise.name !== mapping.germanName ||
        dbExercise.isUnilateral !== mapping.isUnilateral ||
        dbExercise.isDoubleWeight !== mapping.isDoubleWeight;

      if (needsUpdate) {
        await prisma.exercise.update({
          where: { id: dbExercise.id },
          data: {
            name: mapping.germanName,
            isUnilateral: mapping.isUnilateral,
            isDoubleWeight: mapping.isDoubleWeight,
          },
        });
        updatedCount++;
        console.log(`  ✓ Updated: ${mapping.englishName} → ${mapping.germanName}`);
      } else {
        console.log(`  - Skipped (already up-to-date): ${mapping.germanName}`);
      }
    } else {
      notFoundCount++;
      notFound.push(mapping.englishName);
      console.log(`  ⚠️  Not found: ${mapping.englishName}`);
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`  Total exercises in CSV: ${mappings.length}`);
  console.log(`  Total exercises in DB: ${dbExercises.length}`);
  console.log(`  Successfully updated: ${updatedCount}`);
  console.log(`  Not found: ${notFoundCount}`);

  if (notFound.length > 0) {
    console.log('\n⚠️  Exercises not found in database:');
    notFound.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n✅ Migration completed!');
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
