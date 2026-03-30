require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Map CSV values to Prisma enum values
const muscleGroupMap = {
  'Abs': 'ABS',
  'Back': 'BACK',
  'Biceps': 'BICEPS',
  'Triceps': 'TRICEPS',
  'Chest': 'CHEST',
  'Shoulders': 'SHOULDERS',
  'Legs': 'LEGS',
};

const equipmentMap = {
  'Cable': 'CABLE',
  'Machine': 'MACHINE',
  'Dumbbell': 'DUMBBELL',
  'Barbell': 'BARBELL',
  'Bodyweight': 'BODYWEIGHT',
  'Smith Machine': 'SMITH_MACHINE',
  'EZ-Bar': 'EZ_BAR',
};

async function main() {
  console.log('🌱 Start seeding exercises...');

  // Read CSV file
  const csvPath = path.join(__dirname, '../../../Exercises.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.log('❌ Exercises.csv not found at:', csvPath);
    console.log('ℹ️  Please ensure Exercises.csv is in the project root');
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV (skip header)
  const lines = csvContent.split('\n').slice(1);
  const exercises = lines
    .filter((line) => line.trim())
    .map((line) => {
      const [name, muscleGroup, equipment] = line.split(';').map((s) => s.trim());
      return {
        name,
        muscleGroup: muscleGroupMap[muscleGroup],
        equipment: equipmentMap[equipment],
      };
    })
    .filter((ex) => ex.muscleGroup && ex.equipment); // Filter out invalid entries

  console.log(`📋 Parsed ${exercises.length} exercises from CSV`);

  // Insert exercises into database
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const exercise of exercises) {
    try {
      // Use upsert to avoid duplicate entries
      await prisma.exercise.upsert({
        where: {
          // Create a unique constraint based on name
          id: `seed-${exercise.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
        update: {
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
        },
        create: {
          id: `seed-${exercise.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          isCustom: false,
          userId: null,
        },
      });
      successCount++;
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation - exercise already exists
        skipCount++;
      } else {
        console.error(`❌ Failed to create exercise: ${exercise.name}`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`✅ Successfully seeded ${successCount} exercises`);
  if (skipCount > 0) {
    console.log(`ℹ️  Skipped ${skipCount} existing exercises`);
  }
  if (errorCount > 0) {
    console.log(`❌ Failed to create ${errorCount} exercises`);
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
