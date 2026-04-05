/**
 * Production Data Migration: HomeGym System
 * 
 * Migriert existierende User und Workouts zum neuen Multi-HomeGym System:
 * 1. Erstellt "Mein Home Gym" für alle User ohne HomeGyms
 * 2. Migriert Workouts: Setzt homeGymId basierend auf User's erstem HomeGym
 * 3. Migriert WorkoutDays: Setzt plannedHomeGymId auf Cycle-Owner's erstes HomeGym
 * 
 * WICHTIG: Dieses Script ist idempotent - kann mehrfach ausgeführt werden
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting HomeGym Migration...\n');

  try {
    // Schritt 1: Erstelle Default HomeGym für alle User ohne HomeGyms
    console.log('📍 Step 1: Creating default HomeGyms for users...');
    
    const usersWithoutGyms = await prisma.user.findMany({
      where: {
        homeGyms: {
          none: {}
        }
      },
      select: {
        id: true,
        email: true
      }
    });

    console.log(`   Found ${usersWithoutGyms.length} users without HomeGyms`);

    let createdGyms = 0;
    for (const user of usersWithoutGyms) {
      await prisma.homeGym.create({
        data: {
          name: 'Mein Home Gym',
          userId: user.id
        }
      });
      createdGyms++;
      console.log(`   ✅ Created default gym for ${user.email}`);
    }

    console.log(`   ✓ Created ${createdGyms} default HomeGyms\n`);

    // Schritt 2: Migriere Workouts ohne homeGymId
    console.log('📍 Step 2: Migrating workouts to HomeGym system...');
    
    const workoutsToMigrate = await prisma.workout.findMany({
      where: {
        homeGymId: null
      },
      include: {
        user: {
          include: {
            homeGyms: {
              orderBy: {
                createdAt: 'asc'
              },
              take: 1
            }
          }
        }
      }
    });

    console.log(`   Found ${workoutsToMigrate.length} workouts to migrate`);

    let homeWorkouts = 0;
    let otherWorkouts = 0;

    for (const workout of workoutsToMigrate) {
      const firstHomeGym = workout.user.homeGyms[0];
      
      if (!firstHomeGym) {
        console.log(`   ⚠️  User ${workout.userId} has no HomeGym - skipping workout ${workout.id}`);
        continue;
      }

      // Alle existierenden Workouts waren früher "HOME" Workouts
      // (weil "OTHER" nicht in der DB persistiert wurde - war nur Frontend State)
      // Also: Alle Workouts bekommen das erste HomeGym des Users
      await prisma.workout.update({
        where: { id: workout.id },
        data: { homeGymId: firstHomeGym.id }
      });
      
      homeWorkouts++;
    }

    console.log(`   ✓ Migrated ${homeWorkouts} workouts to user's home gym`);
    console.log(`   ✓ ${otherWorkouts} workouts kept as "other gym" (homeGymId=null)\n`);

    // Schritt 3: Migriere WorkoutDays ohne plannedHomeGymId
    console.log('📍 Step 3: Migrating workout days to planned gyms...');
    
    const workoutDaysToMigrate = await prisma.workoutDay.findMany({
      where: {
        plannedHomeGymId: null
      },
      include: {
        cycle: {
          include: {
            user: {
              include: {
                homeGyms: {
                  orderBy: {
                    createdAt: 'asc'
                  },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    console.log(`   Found ${workoutDaysToMigrate.length} workout days to migrate`);

    let migratedDays = 0;
    for (const day of workoutDaysToMigrate) {
      const firstHomeGym = day.cycle.user.homeGyms[0];
      
      if (!firstHomeGym) {
        console.log(`   ⚠️  Cycle owner has no HomeGym - skipping workout day ${day.id}`);
        continue;
      }

      await prisma.workoutDay.update({
        where: { id: day.id },
        data: { plannedHomeGymId: firstHomeGym.id }
      });
      
      migratedDays++;
    }

    console.log(`   ✓ Migrated ${migratedDays} workout days to planned gym\n`);

    // Verification
    console.log('📊 Verification:');
    const totalUsers = await prisma.user.count();
    const usersWithGyms = await prisma.user.count({
      where: {
        homeGyms: {
          some: {}
        }
      }
    });
    
    const totalWorkouts = await prisma.workout.count();
    const workoutsWithGym = await prisma.workout.count({
      where: {
        homeGymId: { not: null }
      }
    });

    const totalDays = await prisma.workoutDay.count();
    const daysWithPlannedGym = await prisma.workoutDay.count({
      where: {
        plannedHomeGymId: { not: null }
      }
    });

    console.log(`   Users: ${usersWithGyms}/${totalUsers} have HomeGyms`);
    console.log(`   Workouts: ${workoutsWithGym}/${totalWorkouts} assigned to HomeGym`);
    console.log(`   Workout Days: ${daysWithPlannedGym}/${totalDays} have planned gym`);

    if (usersWithGyms === totalUsers) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with warnings - some users still without HomeGyms');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
