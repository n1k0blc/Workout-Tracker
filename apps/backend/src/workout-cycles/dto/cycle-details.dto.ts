export class WorkoutsByGymDto {
  gymName: string;
  count: number;
  isHome: boolean;
}

export class CycleDetailsDto {
  // Basic cycle info
  id: string;
  name: string;
  duration: number;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt?: Date;

  // Statistics
  totalVolume: number;
  workoutCount: number;
  workoutsByGym: WorkoutsByGymDto[];

  // Current week (for active cycles)
  currentWeek?: number;
  totalWeeks?: number;
  percentage?: number;
}
