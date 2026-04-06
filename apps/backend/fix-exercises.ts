import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing 3 exercises with name mismatches...\n');

  // Fix 1: Kabel Rudern Wide breiter Griff → Kabel Rudern breiter Griff + csvId 7
  const fix1 = await prisma.exercise.updateMany({
    where: { name: 'Kabel Rudern Wide breiter Griff' },
    data: { name: 'Kabel Rudern breiter Griff', csvId: 7 },
  });
  console.log('✅ Fix 1 (CSV ID 7):', fix1.count, 'exercise(s) updated - Kabel Rudern breiter Griff');

  // Fix 2: Kabel Bar Überkopf Trizeps Externsion → Extension + csvId 108
  const fix2 = await prisma.exercise.updateMany({
    where: { name: 'Kabel Bar Überkopf Trizeps Externsion' },
    data: { name: 'Kabel Bar Überkopf Trizeps Extension', csvId: 108 },
  });
  console.log('✅ Fix 2 (CSV ID 108):', fix2.count, 'exercise(s) updated - Kabel Bar Überkopf Trizeps Extension');

  // Fix 3: Kabel Seil Overhead Trizeps Externsion → Extension + csvId 109
  const fix3 = await prisma.exercise.updateMany({
    where: { name: 'Kabel Seil Overhead Trizeps Externsion' },
    data: { name: 'Kabel Seil Overhead Trizeps Extension', csvId: 109 },
  });
  console.log('✅ Fix 3 (CSV ID 109):', fix3.count, 'exercise(s) updated - Kabel Seil Overhead Trizeps Extension');

  console.log('\n✅ All fixes applied successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
