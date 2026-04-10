# 📊 %ORM Tracking System - Implementation Plan

**Feature:** One-Rep-Max (ORM) Tracking für Zyklusworkouts  
**Created:** 10. April 2026  
**Status:** Planning Phase  
**Timeline:** ~10-15 Stunden Development + Testing

---

## 🎯 Feature Overview

Ermöglicht das Tracking von progressivem Overload über %ORM (Prozent des One-Rep-Max) anstelle von reinem Volumen. Besonders nützlich bei Übungswechseln innerhalb eines Zyklus, da relative Intensität gemessen wird.

### Kernfunktionalität

**Epley-Formel:** `ORM = Gewicht × (1 + (Reps + RIR) / 30)`

**Workflow:**
1. **Erste Ausführung** eines Zyklus-WorkoutDays → Benchmark-Setting
   - Alle WORKING Sets einer Übung → ORM berechnen
   - Durchschnitt = Benchmark für diese Übung
2. **Folgeausführungen** → %ORM Tracking
   - Gewicht / Benchmark × 100 = %ORM
   - Durchschnitt über alle Working Sets
3. **Übungswechsel** → Neuer Benchmark für neue Übung
4. **Rückkehr zu alter Übung** → Alter Benchmark wird verwendet

### Beispiel-Szenario

**Zyklus:** "Hypertrophy Block"  
**WorkoutDay:** "Upper Body" (erscheint 2x pro Woche)

**Erste Ausführung (Benchmark-Setting):**
- Langhantel Bankdrücken:
  - Aufwärmsatz: 10 Wdh × 25kg RIR:0 → **IGNORIERT**
  - Arbeitssatz 1: 10 Wdh × 70kg RIR:2 → ORM = 98kg
  - Arbeitssatz 2: 8 Wdh × 80kg RIR:0 → ORM = 101,3kg
  - **Benchmark = 99,65kg** (Durchschnitt)
- Messung: 70kg/99,65kg = 70,2%, 80kg/99,65kg = 80,2% → **Ø 75,2% ORM**

**Zweite Ausführung (Progress Tracking):**
- Langhantel Bankdrücken (gleiche Übung, alter Benchmark):
  - Arbeitssatz 1: 12 Wdh × 75kg RIR:1 → Messung: 75,2% ORM
  - Arbeitssatz 2: 10 Wdh × 80kg RIR:0 → Messung: 80,2% ORM
  - **Ø 77,7% ORM** → +2,5% Steigerung! 📈

**Dritte Ausführung (Übungswechsel):**
- Kurzhantel Bankdrücken (neue Übung, neuer Benchmark):
  - Arbeitssatz 1: 8 Wdh × 30kg (×2) RIR:2 → ORM = 80kg
  - Arbeitssatz 2: 5 Wdh × 36kg (×2) RIR:0 → ORM = 84kg
  - **Neuer Benchmark = 82kg**
  - Messung: **Ø 81,55% ORM**

**Vierte Ausführung (Rückkehr zu alter Übung):**
- Langhantel Bankdrücken (alte Übung, **alter Benchmark 99,65kg wird verwendet**)
  - Progress messbar gegen ursprüngliche Baseline

---

## 🔒 Scope & Constraints

### ✅ IN SCOPE
- Zyklusworkouts (cycleId != null AND workoutDayId != null)
- **Nur Home Gym Workouts** (homeGymId != null)
  - Grund: Konsistente Gewichte/Equipment, besonders bei Maschinen
  - Andere Gyms haben unterschiedliche Maschinen → inkonsistente Benchmarks
- Status = COMPLETED (nur abgeschlossene Workouts)
- Historische Daten (retroaktive Benchmark-Berechnung via Backfill-Script)

### ❌ OUT OF SCOPE
- Freie Workouts (isFreeWorkout = true)
- Template-Workouts ohne Zyklus
- **Workouts in anderen Gyms** (homeGymId = null)
  - Maschinen haben unterschiedliche Gewichtsverteilungen
  - Würde %ORM Tracking verfälschen
- Live-Anzeige während Workout (kommt später auf Analytics)
- Benchmark-Reset-Funktion (kann später hinzugefügt werden)
- Separate Benchmarks pro Gym (zu komplex)

### � Rationale: Warum nur Home Gym?

**Problem:** Unterschiedliche Gyms verwenden unterschiedliche Maschinen mit verschiedenen:
- Gewichtsblöcken (5kg vs 10kg Abstufungen)
- Seilzug-Übersetzungen (Verhältnis Gewichtsblock zu Griff)
- Hebelwirkungen (Maschinendesign)
- Freihantel-Kalibrierungen

**Beispiel Inkonsistenz:**
- Home Gym: Chest Press Maschine → 80kg für 10 Reps
- Commercial Gym: Andere Chest Press → 80kg fühlt sich wie 60kg an
- Benchmark verfälscht → %ORM nutzlos

**Lösung:** Nur Home Gym Workouts tracken
- Konsistentes Equipment
- Verlässliche Benchmarks
- Korrekte Progress-Messung

**Alternative erwogen:** Separate Benchmarks pro Gym
- ❌ Zu komplex (mehrere Benchmarks verwalten)
- ❌ User-Verwirrung (welcher Benchmark gilt?)  
- ❌ Datenfragmentierung (weniger Workouts pro Benchmark)
- ✅ Bessere Lösung: Fokus auf Home Gym

### ❓ FAQ: Häufige Szenarien

**Q: Was wenn das erste Workout NICHT im Home Gym ist?**
```
Workout 1 (Commercial Gym): Kein ORM Tracking ⏭️
Workout 2 (Home Gym):       Wird zum Benchmark 📊
Workout 3 (Home Gym):       Progress vs. Workout 2
```
**A:** Das **erste Home Gym Workout** wird automatisch zur Baseline.  
Commercial Gym Workouts werden einfach übersprungen.

**Q: Was wenn ich zwischen Gyms wechsle?**
```
Workout 1 (Home Gym):        Benchmark gesetzt ✅
Workout 2 (Commercial Gym):  Kein ORM Tracking ⏭️
Workout 3 (Home Gym):        Progress vs. Workout 1 ✅
```
**A:** Nur Home Gym Workouts werden getrackt und gemessen.  
Commercial Gym Workouts erscheinen nicht in %ORM Analytics.

**Q: Was wenn ich NUR im Commercial Gym trainiere?**
```
Workout 1-10 (Commercial Gym): Kein ORM Tracking ⏭️
```
**A:** Kein %ORM Tracking für diesen Zyklus.  
Nutze stattdessen Volumen-Analytics.

**Q: Kann ich den Benchmark zurücksetzen?**
**A:** Derzeit nicht implementiert. Könnte in Zukunft hinzugefügt werden  
(z.B. nach längerer Pause oder bei Technik-Änderung).

### 📐 Business Rules

| Regel | Implementierung |
|-------|-----------------|
| **Nur Home Gym** | homeGymId != null (konsistentes Equipment) |
| **RIR = null** | Annehmen: RIR = 0 (maximale Anstrengung) |
| **isDoubleWeight = true** | Gewicht × 2 VOR Formel-Anwendung (z.B. Kurzhanteln) |
| **isUnilateral** | Keine Gewichtsanpassung (nur Reps, irrelevant für ORM) |
| **SetType** | Nur WORKING Sets, WARMUP ignorieren |
| **Benchmark Uniqueness** | 1 Benchmark pro (cycleId, workoutDayId, exerciseId) |
| **Duplicate Exercises** | Frontend-Prevention + Toast-Warnung |

---

## 📋 Implementation Phases

### Phase 1: Database Schema & Migration ⏱️ 1-2h

#### 1.1 Schema Changes

**File:** `apps/backend/prisma/schema.prisma`

**Add Model:**
```prisma
model ExerciseBenchmark {
  id             String   @id @default(uuid())
  cycleId        String
  workoutDayId   String
  exerciseId     String
  ormBenchmark   Float    // Berechneter One-Rep-Max Wert
  setAtWorkoutId String   // Workout wo Benchmark gesetzt wurde
  createdAt      DateTime @default(now())
  
  cycle        WorkoutCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  workoutDay   WorkoutDay   @relation(fields: [workoutDayId], references: [id], onDelete: Cascade)
  exercise     Exercise     @relation(fields: [exerciseId], references: [id])
  setAtWorkout Workout      @relation("BenchmarkWorkout", fields: [setAtWorkoutId], references: [id])
  
  @@unique([cycleId, workoutDayId, exerciseId])
  @@index([cycleId, workoutDayId])
}
```

**Update Relations:**
```prisma
// In WorkoutCycle model
model WorkoutCycle {
  // ... existing fields
  exerciseBenchmarks ExerciseBenchmark[]
}

// In WorkoutDay model
model WorkoutDay {
  // ... existing fields
  exerciseBenchmarks ExerciseBenchmark[]
}

// In Exercise model
model Exercise {
  // ... existing fields
  benchmarks ExerciseBenchmark[]
}

// In Workout model
model Workout {
  // ... existing fields
  benchmarksSet ExerciseBenchmark[] @relation("BenchmarkWorkout")
}
```

#### 1.2 Create Migration

```bash
cd apps/backend
npx prisma migrate dev --name add_exercise_orm_benchmarks
npx prisma generate
```

**Expected Output:**
```
✔ Generated Prisma Client (v6.19.2)
Your database is now in sync with your schema.
```

#### 1.3 Historical Data Backfill Script

**File:** `apps/backend/prisma/backfill-orm-benchmarks.ts`

```typescript
import { PrismaClient } from '@prisma/client';

async function backfillORMBenchmarks() {
  const prisma = new PrismaClient();
  
  console.log('🔄 Starting ORM Benchmark backfill...');
  
  // 1. Find all COMPLETED cycle workouts (Home Gym only for consistent equipment)
  const cycleWorkouts = await prisma.workout.findMany({
    where: {
      cycleId: { not: null },
      workoutDayId: { not: null },
      status: 'COMPLETED',
      homeGymId: { not: null }, // Only Home Gym workouts
    },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`📊 Found ${cycleWorkouts.length} completed cycle workouts`);

  // 2. Group by (cycleId, workoutDayId)
  const grouped = new Map<string, typeof cycleWorkouts>();
  
  for (const workout of cycleWorkouts) {
    const key = `${workout.cycleId}-${workout.workoutDayId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(workout);
  }

  console.log(`📦 Grouped into ${grouped.size} workout day groups`);

  let benchmarksCreated = 0;
  let benchmarksSkipped = 0;

  // 3. For each group, process first workout
  for (const [key, workouts] of grouped) {
    const firstWorkout = workouts[0]; // Already sorted by date asc
    
    console.log(`\n🔍 Processing first workout for ${key} (${firstWorkout.date})`);
    
    for (const exerciseLog of firstWorkout.exercises) {
      // 4. Calculate benchmark
      const workingSets = exerciseLog.sets.filter(s => s.setType === 'WORKING');
      
      if (workingSets.length === 0) {
        console.log(`  ⚠️  No working sets for ${exerciseLog.exercise.name}, skipping`);
        benchmarksSkipped++;
        continue;
      }
      
      const ormValues = workingSets.map(set => {
        let weight = set.weight;
        if (exerciseLog.exercise.isDoubleWeight) {
          weight *= 2;
        }
        
        const reps = set.reps;
        const rir = set.rir ?? 0;
        
        return weight * (1 + (reps + rir) / 30);
      });
      
      const benchmark = ormValues.reduce((a, b) => a + b, 0) / ormValues.length;
      
      // 5. Insert benchmark (upsert to handle re-runs)
      try {
        await prisma.exerciseBenchmark.upsert({
          where: {
            cycleId_workoutDayId_exerciseId: {
              cycleId: firstWorkout.cycleId!,
              workoutDayId: firstWorkout.workoutDayId!,
              exerciseId: exerciseLog.exerciseId,
            },
          },
          create: {
            cycleId: firstWorkout.cycleId!,
            workoutDayId: firstWorkout.workoutDayId!,
            exerciseId: exerciseLog.exerciseId,
            ormBenchmark: benchmark,
            setAtWorkoutId: firstWorkout.id,
          },
          update: {}, // Don't update if exists
        });
        
        console.log(`  ✅ Benchmark set: ${exerciseLog.exercise.name} = ${benchmark.toFixed(2)}kg ORM`);
        benchmarksCreated++;
      } catch (error) {
        console.error(`  ❌ Error creating benchmark for ${exerciseLog.exercise.name}:`, error);
      }
    }
  }
  
  console.log(`\n✅ Backfill completed!`);
  console.log(`📈 Benchmarks created: ${benchmarksCreated}`);
  console.log(`⏭️  Benchmarks skipped: ${benchmarksSkipped}`);
  
  await prisma.$disconnect();
}

backfillORMBenchmarks().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
```

**Execution (Local):**
```bash
cd apps/backend
DATABASE_URL="postgresql://localhost:5432/workout_tracker" \
  npx ts-node prisma/backfill-orm-benchmarks.ts
```

**Execution (Production via SSH Tunnel):**
```bash
# On Mac
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# Get DB credentials from Pi
ssh n1k0@n1k0blc-pi.local "cd ~/apps/Workout-Tracker && cat .env.production | grep DB_"

# Run backfill
cd apps/backend
DATABASE_URL="postgresql://USER:PASS@localhost:5433/workout_tracker" \
  npx ts-node prisma/backfill-orm-benchmarks.ts

# Close tunnel
lsof -ti:5433 | xargs kill -9
```

---

### Phase 2: Backend Service Logic ⏱️ 3-4h

#### 2.1 ORM Module Setup

**File:** `apps/backend/src/orm/orm.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ORMService } from './orm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ORMService],
  exports: [ORMService],
})
export class ORMModule {}
```

**Register in App Module:**
```typescript
// apps/backend/src/app.module.ts
import { ORMModule } from './orm/orm.module';

@Module({
  imports: [
    // ... other imports
    ORMModule,
  ],
})
export class AppModule {}
```

#### 2.2 ORM Service Implementation

**File:** `apps/backend/src/orm/orm.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Exercise, SetLog, ExerciseBenchmark } from '@prisma/client';

@Injectable()
export class ORMService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate One-Rep-Max for a single set using Epley formula
   * Formula: Weight × (1 + (Reps + RIR) / 30)
   */
  calculateSetORM(set: SetLog, exercise: Exercise): number {
    let weight = set.weight;
    
    // Apply double weight if applicable (e.g., dumbbells)
    if (exercise.isDoubleWeight) {
      weight *= 2;
    }
    
    const reps = set.reps;
    const rir = set.rir ?? 0; // Null RIR = 0 (max effort)
    
    const orm = weight * (1 + (reps + rir) / 30);
    
    return orm;
  }

  /**
   * Calculate benchmark ORM for an exercise (average of all working sets)
   */
  calculateExerciseBenchmark(
    workingSets: SetLog[],
    exercise: Exercise,
  ): number | null {
    if (workingSets.length === 0) {
      return null; // No working sets = no benchmark
    }
    
    const ormValues = workingSets.map(set => this.calculateSetORM(set, exercise));
    const average = ormValues.reduce((a, b) => a + b, 0) / ormValues.length;
    
    return average;
  }

  /**
   * Calculate %ORM for working sets against benchmark
   */
  calculateExercisePercentORM(
    workingSets: SetLog[],
    benchmark: number,
    exercise: Exercise,
  ): number | null {
    if (workingSets.length === 0 || benchmark === 0) {
      return null;
    }
    
    const percentValues = workingSets.map(set => {
      let weight = set.weight;
      if (exercise.isDoubleWeight) {
        weight *= 2;
      }
      return (weight / benchmark) * 100;
    });
    
    const average = percentValues.reduce((a, b) => a + b, 0) / percentValues.length;
    
    return average;
  }

  /**
   * Get existing benchmark for exercise in cycle workout day
   */
  async getBenchmark(
    cycleId: string,
    workoutDayId: string,
    exerciseId: string,
  ): Promise<ExerciseBenchmark | null> {
    return this.prisma.exerciseBenchmark.findUnique({
      where: {
        cycleId_workoutDayId_exerciseId: {
          cycleId,
          workoutDayId,
          exerciseId,
        },
      },
    });
  }

  /**
   * Create new benchmark
   */
  async createBenchmark(
    cycleId: string,
    workoutDayId: string,
    exerciseId: string,
    ormValue: number,
    workoutId: string,
  ): Promise<ExerciseBenchmark> {
    return this.prisma.exerciseBenchmark.create({
      data: {
        cycleId,
        workoutDayId,
        exerciseId,
        ormBenchmark: ormValue,
        setAtWorkoutId: workoutId,
      },
    });
  }

  /**
   * Check if benchmark should be set (doesn't exist yet)
   */
  async shouldSetBenchmark(
    cycleId: string,
    workoutDayId: string,
    exerciseId: string,
  ): Promise<boolean> {
    const existing = await this.getBenchmark(cycleId, workoutDayId, exerciseId);
    return existing === null;
  }
}
```

#### 2.3 Workout Completion Hook

**File:** `apps/backend/src/workouts/workouts.service.ts`

**Add import:**
```typescript
import { ORMService } from '../orm/orm.service';
```

**Inject in constructor:**
```typescript
@Injectable()
export class WorkoutsService {
  constructor(
    private prisma: PrismaService,
    private ormService: ORMService, // Add this
  ) {}
```

**Modify `updateWorkoutStatus()` method:**

```typescript
async updateWorkoutStatus(
  workoutId: string,
  userId: string,
  status: WorkoutStatus,
  totalDuration?: number,
): Promise<Workout> {
  // ... existing validation code ...

  const updatedWorkout = await this.prisma.workout.update({
    where: { id: workoutId },
    data: { status, totalDuration },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
  });

  // NEW: Set ORM benchmarks for cycle workouts when completed
  if (
    status === 'COMPLETED' &&
    updatedWorkout.cycleId &&
    updatedWorkout.workoutDayId
  ) {
    await this.setORMBenchmarks(updatedWorkout);
  }

  return updatedWorkout;
}
```

**Add private method:**
```typescript
/**
 * Set ORM benchmarks for exercises in cycle workout (if not already set)
 * Only for Home Gym workouts to ensure consistent equipment/weights
 */
private async setORMBenchmarks(workout: Workout & {
  exercises: (ExerciseLog & { exercise: Exercise; sets: SetLog[] })[];
}): Promise<void> {
  const { cycleId, workoutDayId, homeGymId, id: workoutId } = workout;

  // Only track ORM for Home Gym workouts (consistent equipment)
  if (!homeGymId) {
    return; // Skip ORM tracking for non-home gym workouts
  }

  for (const exerciseLog of workout.exercises) {
    const { exerciseId, exercise, sets } = exerciseLog;

    // Check if benchmark already exists
    const shouldSet = await this.ormService.shouldSetBenchmark(
      cycleId!,
      workoutDayId!,
      exerciseId,
    );

    if (!shouldSet) {
      continue; // Benchmark already set in previous workout
    }

    // Calculate benchmark from working sets
    const workingSets = sets.filter(s => s.setType === 'WORKING');
    const benchmark = this.ormService.calculateExerciseBenchmark(
      workingSets,
      exercise,
    );

    if (benchmark === null) {
      console.warn(
        `⚠️  No working sets for exercise ${exercise.name} in workout ${workoutId}. ` +
        `Benchmark not set. This may happen if only warmup sets were logged.`
      );
      continue; // Skip if no working sets
    }

    // Create benchmark
    await this.ormService.createBenchmark(
      cycleId!,
      workoutDayId!,
      exerciseId,
      benchmark,
      workoutId,
    );

    console.log(
      `✅ Benchmark set: ${exercise.name} = ${benchmark.toFixed(2)}kg ORM (Workout ${workoutId})`,
    );
  }
}
```

**Update Module:**
```typescript
// apps/backend/src/workouts/workouts.module.ts
import { ORMModule } from '../orm/orm.module';

@Module({
  imports: [PrismaModule, ORMModule], // Add ORMModule
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
```

#### 2.4 Analytics Endpoint

**File:** `apps/backend/src/analytics/analytics.controller.ts`

**Add import and injection:**
```typescript
import { ORMService } from '../orm/orm.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private ormService: ORMService, // Add this
  ) {}
```

**Add endpoint:**
```typescript
@Get('orm/:cycleId/:workoutDayId')
@UseGuards(JwtAuthGuard)
async getORMAnalytics(
  @Param('cycleId') cycleId: string,
  @Param('workoutDayId') workoutDayId: string,
  @CurrentUser() user: { id: string },
) {
  return this.analyticsService.getORMAnalytics(cycleId, workoutDayId, user.id);
}
```

**File:** `apps/backend/src/analytics/analytics.service.ts`

**Add import:**
```typescript
import { ORMService } from '../orm/orm.service';
```

**Inject in constructor:**
```typescript
constructor(
  private prisma: PrismaService,
  private ormService: ORMService, // Add this
) {}
```

**Add method:**
```typescript
async getORMAnalytics(
  cycleId: string,
  workoutDayId: string,
  userId: string,
) {
  // 1. Verify user owns this cycle
  const cycle = await this.prisma.workoutCycle.findFirst({
    where: { id: cycleId, userId },
  });

  if (!cycle) {
    throw new NotFoundException('Cycle not found');
  }

  // 2. Get all completed workouts for this workout day (Home Gym only)
  const workouts = await this.prisma.workout.findMany({
    where: {
      cycleId,
      workoutDayId,
      status: 'COMPLETED',
      homeGymId: { not: null }, // Only Home Gym workouts for consistent equipment
    },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // 3. For each workout, calculate ORM data
  const workoutsData = await Promise.all(
    workouts.map(async workout => {
      const exercisesData = await Promise.all(
        workout.exercises.map(async exerciseLog => {
          const { exerciseId, exercise, sets } = exerciseLog;

          // Get benchmark
          const benchmarkRecord = await this.ormService.getBenchmark(
            cycleId,
            workoutDayId,
            exerciseId,
          );

          if (!benchmarkRecord) {
            return null; // No benchmark = skip
          }

          // Calculate %ORM
          const workingSets = sets.filter(s => s.setType === 'WORKING');
          const percentORM = this.ormService.calculateExercisePercentORM(
            workingSets,
            benchmarkRecord.ormBenchmark,
            exercise,
          );

          return {
            exerciseId,
            exerciseName: exercise.name,
            benchmark: benchmarkRecord.ormBenchmark,
            percentORM,
            wasBenchmarkSet: benchmarkRecord.setAtWorkoutId === workout.id,
          };
        }),
      );

      return {
        workoutId: workout.id,
        date: workout.date.toISOString(),
        exercises: exercisesData.filter(e => e !== null),
      };
    }),
  );

  return { workouts: workoutsData };
}
```

**Update Module:**
```typescript
// apps/backend/src/analytics/analytics.module.ts
import { ORMModule } from '../orm/orm.module';

@Module({
  imports: [PrismaModule, ORMModule], // Add ORMModule
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
```

---

### Phase 3: Edge Case Handling ⏱️ 2-3h

#### 3.1 Edge Cases Matrix

| Szenario | Verhalten | Implementation |
|----------|-----------|----------------|
| **Übung austauschen** | Benchmark für alte bleibt, neuer für neue | Automatic via `shouldSetBenchmark()` check |
| **Ungeplante Übung** | Behandlung wie geplante Übung | Same logic, no special handling |
| **Übung löschen** | Benchmark bleibt (für Rückkehr) | No cascade delete on ExerciseBenchmark |
| **Nur Aufwärmsätze** | Kein Benchmark, logging | `calculateExerciseBenchmark()` returns null |
| **Sätze löschen** | ORM mit verbleibenden Sets | Calculated from remaining sets |
| **Ungeplante Sätze** | In Berechnung einbeziehen | Included if setType = WORKING |
| **Duplicate Exercise** | Prevention + Toast | Frontend validation (siehe 3.2) |

#### 3.2 Duplicate Exercise Prevention

**Prerequisites:**
```bash
cd apps/frontend
npm install react-hot-toast
```

**File:** `apps/frontend/app/layout.tsx`

**Add Toaster component:**
```typescript
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

**File:** `apps/frontend/components/workout/exercise-selection-modal.tsx`

**Add import:**
```typescript
import toast from 'react-hot-toast';
```

**Locate the exercise selection handler (likely `handleExerciseSelect` or similar):**

```typescript
const handleExerciseSelect = (exercise: Exercise) => {
  // NEW: Check if exercise already exists in workout
  const isDuplicate = workoutExercises.some(
    ex => ex.exerciseId === exercise.id
  );

  if (isDuplicate) {
    // Show toast warning
    toast.error(
      'Diese Übung ist bereits im Workout. Füge stattdessen Sätze zur bestehenden Übung hinzu.',
      {
        duration: 4000,
      }
    );
    return; // Don't add, keep modal open
  }

  // Proceed with adding exercise
  onExerciseSelected(exercise);
  onClose();
};
```

**Alternative Implementation (if workout exercises not directly available):**

Find where exercises are fetched/stored (e.g., `workout.exercises`) and pass to modal:

```typescript
// In parent component (e.g., workout-screen.tsx)
<ExerciseSelectionModal
  existingExercises={workout.exercises}
  onSelect={handleAddExercise}
/>

// In modal
interface ExerciseSelectionModalProps {
  existingExercises: ExerciseLog[];
  onSelect: (exercise: Exercise) => void;
}

const handleSelect = (exercise: Exercise) => {
  const isDuplicate = existingExercises.some(
    ex => ex.exerciseId === exercise.id
  );
  
  if (isDuplicate) {
    toast.error('Übung bereits im Workout vorhanden!');
    return;
  }
  
  onSelect(exercise);
};
```

---

### Phase 4: Frontend Types & API Client ⏱️ 1h

#### 4.1 TypeScript Types

**File:** `apps/frontend/types/index.ts`

**Add after Exercise interface:**

```typescript
export interface ExerciseBenchmark {
  id: string;
  cycleId: string;
  workoutDayId: string;
  exerciseId: string;
  ormBenchmark: number;
  setAtWorkoutId: string;
  createdAt: string;
}

export interface ORMAnalytics {
  workouts: {
    workoutId: string;
    date: string;
    exercises: {
      exerciseId: string;
      exerciseName: string;
      benchmark: number;
      percentORM: number | null;
      wasBenchmarkSet: boolean;
    }[];
  }[];
}
```

#### 4.2 API Client Method

**File:** `apps/frontend/lib/api/client.ts`

**Add to imports:**
```typescript
import {
  // ... existing imports
  ORMAnalytics,
} from '@/types';
```

**Add method (in Analytics section, after other analytics methods):**
```typescript
// ORM Analytics
async getORMAnalytics(
  cycleId: string,
  workoutDayId: string,
): Promise<ORMAnalytics> {
  return this.request<ORMAnalytics>(
    `/analytics/orm/${cycleId}/${workoutDayId}`
  );
}
```

---

### Phase 5: Testing & Verification ⏱️ 2-3h

#### 5.1 Unit Tests

**File:** `apps/backend/src/orm/orm.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ORMService } from './orm.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetLog, Exercise } from '@prisma/client';

describe('ORMService', () => {
  let service: ORMService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ORMService,
        {
          provide: PrismaService,
          useValue: {}, // Mock Prisma
        },
      ],
    }).compile();

    service = module.get<ORMService>(ORMService);
  });

  describe('calculateSetORM', () => {
    it('should calculate ORM correctly for normal set', () => {
      const set = {
        reps: 10,
        weight: 70,
        rir: 2,
      } as SetLog;

      const exercise = {
        isDoubleWeight: false,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // 70 × (1 + (10 + 2) / 30) = 70 × 1.4 = 98
      expect(orm).toBeCloseTo(98, 1);
    });

    it('should handle double weight exercises', () => {
      const set = {
        reps: 8,
        weight: 30,
        rir: 2,
      } as SetLog;

      const exercise = {
        isDoubleWeight: true,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // (30 × 2) × (1 + (8 + 2) / 30) = 60 × 1.333 = 80
      expect(orm).toBeCloseTo(80, 1);
    });

    it('should treat null RIR as 0', () => {
      const set = {
        reps: 8,
        weight: 80,
        rir: null,
      } as SetLog;

      const exercise = {
        isDoubleWeight: false,
      } as Exercise;

      const orm = service.calculateSetORM(set, exercise);

      // 80 × (1 + (8 + 0) / 30) = 80 × 1.267 = 101.33
      expect(orm).toBeCloseTo(101.33, 1);
    });
  });

  describe('calculateExerciseBenchmark', () => {
    it('should calculate average ORM from multiple sets', () => {
      const sets = [
        { reps: 10, weight: 70, rir: 2 },
        { reps: 8, weight: 80, rir: 0 },
      ] as SetLog[];

      const exercise = { isDoubleWeight: false } as Exercise;

      const benchmark = service.calculateExerciseBenchmark(sets, exercise);

      // Set 1: 70 × (1 + 12/30) = 98
      // Set 2: 80 × (1 + 8/30) = 101.33
      // Average: (98 + 101.33) / 2 = 99.665
      expect(benchmark).toBeCloseTo(99.665, 1);
    });

    it('should return null for empty working sets', () => {
      const benchmark = service.calculateExerciseBenchmark(
        [],
        {} as Exercise,
      );

      expect(benchmark).toBeNull();
    });
  });

  describe('calculateExercisePercentORM', () => {
    it('should calculate %ORM correctly', () => {
      const sets = [
        { reps: 10, weight: 70, rir: 2 },
        { reps: 8, weight: 80, rir: 0 },
      ] as SetLog[];

      const exercise = { isDoubleWeight: false } as Exercise;
      const benchmark = 99.65;

      const percentORM = service.calculateExercisePercentORM(
        sets,
        benchmark,
        exercise,
      );

      // Set 1: 70 / 99.65 = 0.702 = 70.2%
      // Set 2: 80 / 99.65 = 0.802 = 80.2%
      // Average: 75.2%
      expect(percentORM).toBeCloseTo(75.2, 1);
    });

    it('should handle double weight in %ORM calculation', () => {
      const sets = [{ reps: 8, weight: 30, rir: 0 }] as SetLog[];

      const exercise = { isDoubleWeight: true } as Exercise;
      const benchmark = 82;

      const percentORM = service.calculateExercisePercentORM(
        sets,
        benchmark,
        exercise,
      );

      // (30 × 2) / 82 = 60 / 82 = 0.731 = 73.1%
      expect(percentORM).toBeCloseTo(73.1, 1);
    });
  });
});
```

**Run tests:**
```bash
cd apps/backend
npm run test -- orm.service.spec
```

#### 5.2 Integration Test Scenarios

**Manual Testing Checklist:**

- [ ] **Scenario 1: First Cycle Workout**
  1. Create new cycle "Hypertrophy Block" with workout day "Upper"
  2. Start workout for "Upper"
  3. Add exercise "Barbell Bench Press"
  4. Log sets: 1 warmup (ignored), 2 working sets
  5. Complete workout (status → COMPLETED)
  6. **Verify:** Check database for ExerciseBenchmark entry
  ```sql
  SELECT * FROM "ExerciseBenchmark" WHERE "exerciseId" = '<bench-press-id>';
  ```
  7. **Verify:** ORM value matches manual calculation

- [ ] **Scenario 2: Second Execution (Same Exercise)**
  1. Start "Upper" workout again (same cycle, same day)
  2. Use same exercise "Barbell Bench Press"
  3. Log different weights/reps
  4. Complete workout
  5. **Verify:** No new benchmark created (count still 1)
  6. **Verify:** GET /analytics/orm/:cycleId/:workoutDayId shows 2 workouts

- [ ] **Scenario 3: Exercise Change**
  1. Start "Upper" workout third time
  2. Remove "Barbell Bench Press"
  3. Add "Dumbbell Bench Press" (isDoubleWeight = true)
  4. Complete workout
  5. **Verify:** New benchmark created for Dumbbell BP
  6. **Verify:** Old benchmark for Barbell BP still exists
  7. **Verify:** Benchmark count = 2

- [ ] **Scenario 4: Return to Old Exercise**
  1. Start "Upper" workout fourth time
  2. Use "Barbell Bench Press" again
  3. Complete workout
  4. **Verify:** Still uses original benchmark (not new one)
  5. **Verify:** Benchmark count still = 2

- [ ] **Scenario 5: Warmup Sets Only**
  1. Start workout, add exercise
  2. Log only warmup sets (setType = WARMUP)
  3. Complete workout
  4. **Verify:** No benchmark created
  5. **Verify:** Warning logged in backend console

- [ ] **Scenario 6: Double Weight Exercise**
  1. Add exercise with isDoubleWeight = true (e.g., Dumbbell Curls)
  2. Log working set: 10 reps × 15kg, RIR 2
  3. Complete workout
  4. **Verify:** ORM = (15 × 2) × (1 + 12/30) = 42kg
  5. **Verify:** Benchmark stored correctly

- [ ] **Scenario 7: Duplicate Prevention**
  1. Start workout
  2. Add exercise "Barbell Squat"
  3. Try to add "Barbell Squat" again
  4. **Verify:** Toast error shown
  5. **Verify:** Exercise not added to workout

- [ ] **Scenario 8: RIR = null Handling**
  1. Modify SetLog in DB to have RIR = null
  2. Recalculate ORM (or test unit test scenario)
  3. **Verify:** Treated as RIR = 0

#### 5.3 Backfill Script Verification

**Local Testing:**

```bash
# 1. Seed test data (create cycle + completed workouts)
# 2. Run backfill script
cd apps/backend
DATABASE_URL="postgresql://localhost:5432/workout_tracker" \
  npx ts-node prisma/backfill-orm-benchmarks.ts

# 3. Verify benchmarks created
psql "postgresql://localhost:5432/workout_tracker" -c \
  "SELECT COUNT(*) FROM \"ExerciseBenchmark\";"

# 4. Spot check: View sample benchmarks
psql "postgresql://localhost:5432/workout_tracker" -c \
  "SELECT eb.\"ormBenchmark\", e.name AS exercise 
   FROM \"ExerciseBenchmark\" eb 
   JOIN \"Exercise\" e ON e.id = eb.\"exerciseId\" 
   LIMIT 5;"

# 5. Verify no duplicates (should be 0)
psql "postgresql://localhost:5432/workout_tracker" -c \
  "SELECT \"cycleId\", \"workoutDayId\", \"exerciseId\", COUNT(*) 
   FROM \"ExerciseBenchmark\" 
   GROUP BY \"cycleId\", \"workoutDayId\", \"exerciseId\" 
   HAVING COUNT(*) > 1;"
```

**Production Testing:**

```bash
# 1. SSH tunnel to production DB (see Phase 1.3)
# 2. Dry-run mode (add console.log only, no DB writes for verification)
# 3. Execute actual backfill
# 4. Verify with production DB queries
```

---

## 🗂️ File Changes Summary

### New Files (8)

**Backend:**
- `apps/backend/src/orm/orm.module.ts` — Module definition
- `apps/backend/src/orm/orm.service.ts` — ORM calculations, benchmark management
- `apps/backend/src/orm/orm.service.spec.ts` — Unit tests
- `apps/backend/prisma/backfill-orm-benchmarks.ts` — Historical data migration script
- `apps/backend/prisma/migrations/XXXXXX_add_exercise_orm_benchmarks/migration.sql` — Schema migration

**Frontend:**
- None (only modifications to existing files)

### Modified Files (11)

**Backend:**
- `apps/backend/prisma/schema.prisma` — Add ExerciseBenchmark model + relations
- `apps/backend/src/app.module.ts` — Import ORMModule
- `apps/backend/src/workouts/workouts.module.ts` — Import ORMModule
- `apps/backend/src/workouts/workouts.service.ts` — Add benchmark-setting hook
- `apps/backend/src/analytics/analytics.module.ts` — Import ORMModule
- `apps/backend/src/analytics/analytics.controller.ts` — Add ORM endpoint
- `apps/backend/src/analytics/analytics.service.ts` — Add getORMAnalytics()

**Frontend:**
- `apps/frontend/types/index.ts` — Add ExerciseBenchmark, ORMAnalytics types
- `apps/frontend/lib/api/client.ts` — Add getORMAnalytics()
- `apps/frontend/components/workout/exercise-selection-modal.tsx` — Duplicate prevention
- `apps/frontend/app/layout.tsx` — Add Toaster component

---

## 📈 Success Criteria

### Phase 1 ✅
- [ ] ExerciseBenchmark table exists in database
- [ ] Unique constraint on (cycleId, workoutDayId, exerciseId) works
- [ ] Index on (cycleId, workoutDayId) exists
- [ ] Backfill script runs without errors
- [ ] Historical benchmarks created for all completed cycle workouts

### Phase 2 ✅
- [ ] ORMService calculates ORM correctly (unit tests pass)
- [ ] Benchmarks auto-created when completing cycle workouts
- [ ] Analytics endpoint returns ORM data
- [ ] Double weight exercises handled correctly
- [ ] No errors in backend logs when completing workouts

### Phase 3 ✅
- [ ] Exercise changes create new benchmarks
- [ ] Returning to old exercise uses old benchmark
- [ ] Warmup-only workouts don't crash (null handling)
- [ ] Duplicate exercise shows toast warning
- [ ] Toast appears in correct position (top-center)

### Phase 4 ✅
- [ ] TypeScript types compile without errors
- [ ] API client method callable
- [ ] No type errors in frontend

### Phase 5 ✅
- [ ] All unit tests pass (npm run test)
- [ ] All integration scenarios verified manually
- [ ] Backfill script verified on dev DB
- [ ] No regressions in existing workout flow
- [ ] Production data backfilled successfully

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All unit tests pass locally
- [ ] Integration tests completed
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend builds without errors (`npm run build`)
- [ ] Git changes committed to dev branch
- [ ] PR created and reviewed

### Deployment Steps
1. [ ] Merge PR to main
2. [ ] SSH to Pi: `ssh n1k0@n1k0blc-pi.local`
3. [ ] Navigate: `cd ~/apps/Workout-Tracker`
4. [ ] Pull latest: `git pull origin main`
5. [ ] Run deploy.sh: `./deploy.sh`
6. [ ] Wait for Docker build + container restart (15-30 min)
7. [ ] Verify containers: `docker ps` (all healthy)
8. [ ] Check logs: `docker logs workout-tracker-backend-prod --tail 50`
9. [ ] Run backfill script via SSH tunnel (see Phase 1.3)
10. [ ] Verify benchmarks in production DB
11. [ ] Test analytics endpoint: `curl https://workout.nikobjelic.com/api/analytics/orm/...`

### Post-Deployment
- [ ] Monitor logs for errors: `docker compose -f docker-compose.prod.yml logs -f`
- [ ] Verify existing workouts unaffected
- [ ] Test new cycle workout creation → completion → benchmark
- [ ] Smoke test: Complete one workout, verify benchmark created
- [ ] Analytics page accessible (when implemented later)

---

## 🔮 Future Enhancements (Out of Current Scope)

### Analytics Page Integration
- Line chart: %ORM over time for workout day
- Muscle group aggregation (average %ORM per muscle group)
- Strength imbalances visualization
- Volume vs Intensity balance chart
- Progress bars showing %ORM trends

### Advanced Features
- Benchmark recalculation/reset (manual trigger)
- Export ORM data to CSV
- Compare %ORM across different cycles
- Predictive analytics (trend lines, plateau detection)
- Benchmark history (track when benchmarks were set/changed)
- Notification when new PR for %ORM

### Performance Optimization
- Caching benchmark lookups (Redis/in-memory)
- Batch analytics calculations
- Database indexes on commonly queried fields
- Materialized views for complex analytics

### UX Improvements
- Show %ORM live during workout (optional)
- Benchmark indicators in workout history
- Color-coded %ORM badges (green = progress, red = decline)
- Exercise substitution suggestions based on muscle group

---

## 📚 References & Resources

### Epley Formula
- **Standard:** One-Rep Max = Weight × (1 + Reps / 30)
- **Modified for RIR:** Weight × (1 + (Reps + RIR) / 30)
- **Source:** [Epley Formula on Wikipedia](https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula)

### Database Schema
- **Hierarchy:** WorkoutCycle → WorkoutDay → Workout → ExerciseLog → SetLog
- **New Relation:** ExerciseBenchmark links to: Cycle, WorkoutDay, Exercise, Workout
- **Unique Constraint:** @@unique([cycleId, workoutDayId, exerciseId])

### Related Documentation
- [Deployment Guide](DEPLOYMENT-GUIDE-CUSTOMIZED.md) — SSH tunnel, backfill execution
- [Database Schema](apps/backend/prisma/schema.prisma) — Full Prisma schema
- [Session Plan](memories/session/plan.md) — Condensed version of this plan

### Testing Resources
- [Jest Documentation](https://jestjs.io/) — Unit testing framework
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) — Testing NestJS apps
- [Prisma Testing](https://www.prisma.io/docs/guides/testing) — Testing with Prisma

---

## 📊 Timeline & Estimation

| Phase | Task | Estimated Time | Cumulative |
|-------|------|----------------|------------|
| **1** | Schema changes + migration | 30 min | 30 min |
| **1** | Backfill script development | 1 hour | 1.5h |
| **2** | ORM Service implementation | 2 hours | 3.5h |
| **2** | Workout completion hook | 1 hour | 4.5h |
| **2** | Analytics endpoint | 1 hour | 5.5h |
| **3** | Edge case handling | 2 hours | 7.5h |
| **3** | Duplicate prevention | 1 hour | 8.5h |
| **4** | Frontend types + API | 1 hour | 9.5h |
| **5** | Unit tests | 2 hours | 11.5h |
| **5** | Integration tests | 2 hours | 13.5h |
| **5** | Backfill verification | 1 hour | 14.5h |
| **Deploy** | Deployment + verification | 1 hour | **15.5h** |

**Backfill Script Execution:** 5-30 minutes (depending on data volume)

**Buffer:** Add 20% for unexpected issues = **~18-19 hours total**

---

## 🎯 Next Steps

1. **Review this plan** — Confirm all requirements covered
2. **Start with Phase 1** — Database schema is foundation
3. **Test early, test often** — Verify each phase before moving on
4. **Track progress** — Check off items in Success Criteria
5. **Document edge cases** — Add to plan if new ones discovered

---

**Last Updated:** 10. April 2026  
**Next Review:** After Phase 1 completion  
**Status:** Ready to implement 🚀
