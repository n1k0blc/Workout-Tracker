import { WorkoutExerciseResponseDto } from '../../common/dto/workout-tree.dto';

export class HomeGymDto {
  id: string;
  name: string;
}

export class WorkoutResponseDto {
  id: string;
  date: Date;
  /** The calendar day the workout happened on in the user's timezone, `YYYY-MM-DD`. */
  localDate: string;
  isFreeWorkout: boolean;
  totalDuration?: number;
  homeGymId?: string;
  homeGym?: HomeGymDto;
  cycleId?: string;
  cycleName?: string;
  workoutDayId?: string;
  workoutDayName?: string;
  originTemplateId?: string;
  originTemplateName?: string;
  exercises: WorkoutExerciseResponseDto[];
  createdAt: Date;
}

export class WorkoutListItemDto {
  id: string;
  date: Date;
  isFreeWorkout: boolean;
  totalDuration?: number;
  totalVolume: number;
  homeGymId?: string | null;
  homeGym?: {
    id: string;
    name: string;
  };
  cycleName?: string;
  workoutDayName?: string;
  workoutDayWeekday?: number;
  originTemplateId?: string;
  originTemplateName?: string;
  exerciseCount: number;
  createdAt: Date;
}
