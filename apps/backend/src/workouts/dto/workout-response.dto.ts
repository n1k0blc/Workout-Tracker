import { SetType } from '../../common/types';

export enum WorkoutStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DISCARDED = 'DISCARDED',
}

export class PlannedSetDto {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  restAfterSet: number;
}

export class SetLogDto {
  id: string;
  setNumber: number;
  setType?: SetType;
  reps: number;
  weight: number;
  rir?: number;
  targetReps?: number;
  targetWeight?: number;
  targetRir?: number;
  actualRestDuration?: number;
  completedAt: Date;
}

export class ExerciseLogDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: SetLogDto[];
  plannedSets?: PlannedSetDto[];
}

export class WorkoutResponseDto {
  id: string;
  date: Date;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  cycleId?: string;
  cycleName?: string;
  workoutDayId?: string;
  workoutDayName?: string;
  exercises: ExerciseLogDto[];
  createdAt: Date;
}

export class WorkoutListItemDto {
  id: string;
  date: Date;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  cycleName?: string;
  workoutDayName?: string;
  exerciseCount: number;
  createdAt: Date;
}
