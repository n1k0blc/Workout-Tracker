import { SetType } from '../../common/types';

export enum WorkoutStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DISCARDED = 'DISCARDED',
}

export class HomeGymDto {
  id: string;
  name: string;
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
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
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
  homeGymId?: string;
  homeGym?: HomeGymDto;
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
  homeGymId?: string | null;
  homeGym?: {
    id: string;
    name: string;
  };
  cycleName?: string;
  workoutDayName?: string;
  exerciseCount: number;
  createdAt: Date;
}
