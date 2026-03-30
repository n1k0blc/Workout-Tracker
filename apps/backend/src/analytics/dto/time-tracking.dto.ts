export class TimeTrackingDataPoint {
  date: string;
  duration: number; // minutes
  workoutId: string;
}

export class TimeTrackingDto {
  period: string;
  totalMinutes: number;
  averageDuration: number;
  workoutCount: number;
  dataPoints: TimeTrackingDataPoint[];
}
