-- CreateTable
CREATE TABLE "ExerciseBenchmark" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "workoutDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "ormBenchmark" DOUBLE PRECISION NOT NULL,
    "setAtWorkoutId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseBenchmark_cycleId_workoutDayId_idx" ON "ExerciseBenchmark"("cycleId", "workoutDayId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseBenchmark_cycleId_workoutDayId_exerciseId_key" ON "ExerciseBenchmark"("cycleId", "workoutDayId", "exerciseId");

-- AddForeignKey
ALTER TABLE "ExerciseBenchmark" ADD CONSTRAINT "ExerciseBenchmark_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "WorkoutCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseBenchmark" ADD CONSTRAINT "ExerciseBenchmark_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseBenchmark" ADD CONSTRAINT "ExerciseBenchmark_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseBenchmark" ADD CONSTRAINT "ExerciseBenchmark_setAtWorkoutId_fkey" FOREIGN KEY ("setAtWorkoutId") REFERENCES "Workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
