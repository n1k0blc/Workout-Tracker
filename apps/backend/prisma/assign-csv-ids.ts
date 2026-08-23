import { PrismaClient } from '../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExerciseCsvRow {
  ID: number;
  Name: string;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
}

function parseCsv(csvPath: string): ExerciseCsvRow[] {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(';'); // Semikolon statt Komma
    return {
      ID: parseInt(values[0]),
      Name: values[1].trim(), // Spalte "Übung"
      isUnilateral: values[4].trim() === 'ja', // Spalte "Unilateral"
      isDoubleWeight: values[6].trim() === 'ja', // Spalte "Gewicht 2x"
    };
  });
}

async function main() {
  console.log('🔄 Starting CSV ID assignment...\n');

  // Pfad zur CSV-Datei (Production oder Development)
  const csvPath = process.env.NODE_ENV === 'production'
    ? '/app/Exercises.csv'
    : path.join(__dirname, '../../../Exercises.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  // Parse CSV
  const exercises = parseCsv(csvPath);
  console.log(`📋 Parsed ${exercises.length} exercises from CSV\n`);

  let assigned = 0;
  let notFound = 0;

  for (const csvExercise of exercises) {
    // Suche Exercise in DB nach Name
    const dbExercise = await prisma.exercise.findFirst({
      where: { name: csvExercise.Name }
    });

    if (dbExercise) {
      // Prüfe ob csvId bereits gesetzt ist
      if (dbExercise.csvId === null) {
        await prisma.exercise.update({
          where: { id: dbExercise.id },
          data: { csvId: csvExercise.ID }
        });
        console.log(`✅ Assigned ID ${csvExercise.ID} to "${csvExercise.Name}"`);
        assigned++;
      } else {
        console.log(`⏭️  Skipped "${csvExercise.Name}" (already has csvId: ${dbExercise.csvId})`);
      }
    } else {
      console.log(`⚠️  Exercise not found in DB: "${csvExercise.Name}"`);
      notFound++;
    }
  }

  console.log(`\n📊 Assignment Summary:`);
  console.log(`✅ Successfully assigned: ${assigned} exercises`);
  console.log(`⚠️  Not found: ${notFound} exercises`);
  console.log(`✅ Assignment completed!\n`);
}

main()
  .catch((e) => {
    console.error('❌ Assignment failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
