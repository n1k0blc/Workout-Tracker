export class CurrentWeekStatsDto {
  workouts: number;
  volume: number;
  averageDuration: number | null;
}

export class LastWeekStatsDto {
  volume: number;
}

export class DashboardStatsDto {
  currentWeek: CurrentWeekStatsDto;
  lastWeek: LastWeekStatsDto;
  volumeChange: number;
}
