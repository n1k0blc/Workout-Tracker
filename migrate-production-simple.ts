import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function parseCSV(filePath: string): Promise<string[][]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.map(line => line.split(';'));
}

async function main() {
  console.log('🚀 Starting Production Exercise Migration...\n');

  const oldCsvPath = '/app/Exercises_old.csv';
  const newCsvPath = '/app/Exercises.csv';

  console.log('📖 Reading CSV files...');
  const oldData = await parseCSV(oldCsvPath);
  const newData = await parseCSV(newCsvPath);

  oldData.shift();
  newData.shift();

  console.log(`✓ Found ${oldData.length} exercises in old CSV`);
  console.log(`✓ Found ${newData.length} exercises in new CSV\n`);

  const mappings: any[] = newData.map((row) => {
    const id = parseInt(row[0]);
    const germanName = row[1];
    const isUnilateral = row[4] === 'X';
    const isDoubleWeight = row[6] === 'X';
    
    const oldRow = oldData.find(r => parseInt(r[0]) === id);
    const englishName = oldRow ? oldRow[1] : germanName;

    return {
      id,
      germanName,
      englishName,
      isUnilateral,
      isDoubleWeight
    };
  });

  console.log('🔄 Updating exercises...\n');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const mapping of mappings) {
    try {
      const existing = await prisma.exercise.findUnique({
        where: { id: mapping.id }
      });

      if (!existing) {
        console.log(`⚠️  Exercise ID ${mapping.id} (${mapping.germanName}) not found in database`);
        notFound++;
        continue;
      }

      const needsUpdate = 
        existing.name !== mapping.germanName ||
        (existing.isUnilateral ?? false) !== mapping.isUnilateral ||
        (existing.isDoubleWeight ?? false) !== mapping.isDoubleWeight;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      await prisma.exercise.update({
        where: { id: mapping.id },
        data: {
          name: mapping.germanName,
          isUnilateral: mapping.isUnilateral,
          isDoubleWeight: mapping.isDoubleWeight
        }
      });

      updated++;
      console.log(`✓ Updated: ${mapping.germanName} (ID: ${mapping.id})`);
    } catch (error: any) {
      console.error(`❌ Error updating exercise ID ${mapping.id}:`, error.message);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already correct): ${skipped}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Total processed: ${mappings.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
