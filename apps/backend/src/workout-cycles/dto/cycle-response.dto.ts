import { SetType } from '../../common/types';
import { CycleStatus } from '@prisma/client';

export class HomeGymDto {
  id: string;
  name: string;
}

export class BlueprintSetResponseDto {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  restAfterSet: number;
}

export class BlueprintExerciseResponseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: BlueprintSetResponseDto[];
}

export class WorkoutBlueprintResponseDto {
  id: string;
  exercises: BlueprintExerciseResponseDto[];
  updatedAt: Date;
}

export class WorkoutDayResponseDto {
  id: string;
  weekday: number;
  name: string;
  plannedHomeGymId?: string;
  plannedHomeGym?: HomeGymDto;
  blueprint?: WorkoutBlueprintResponseDto;
}

export class CycleResponseDto {
  id: string;
  name: string;
  duration: number;
  startDate: Date;
  createdAt: Date;
  status: CycleStatus;
  completedAt?: Date;
  workoutDays: WorkoutDayResponseDto[];
}
