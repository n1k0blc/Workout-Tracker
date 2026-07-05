import { CycleStatus } from '@prisma/client';
import { WorkoutExerciseResponseDto } from '../../common/dto/workout-tree.dto';

export class HomeGymDto {
  id: string;
  name: string;
}

export class WorkoutBlueprintResponseDto {
  id: string;
  updatedAt: Date;
  exercises: WorkoutExerciseResponseDto[];
}

export class WorkoutDayResponseDto {
  id: string;
  weekday: number;
  order: number;
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
