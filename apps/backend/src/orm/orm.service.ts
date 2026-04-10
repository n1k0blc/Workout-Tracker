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
