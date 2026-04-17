export class NextPlannedWorkoutDto {
  workoutDayId: string;
  workoutDayName: string;
  cycleName: string;
  templateName: string | null;
  dayOfWeek: number;
  suggestedDate: string;
}
