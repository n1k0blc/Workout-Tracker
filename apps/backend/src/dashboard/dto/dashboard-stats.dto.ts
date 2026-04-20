export class LastSevenDaysStatsDto {
  workouts: number;
  volume: number;
  averageDuration: number | null;
}

export class PreviousSevenDaysStatsDto {
  volume: number;
}

export class DashboardStatsDto {
  lastSevenDays: LastSevenDaysStatsDto;
  previousSevenDays: PreviousSevenDaysStatsDto;
  volumeChange: number;
}
