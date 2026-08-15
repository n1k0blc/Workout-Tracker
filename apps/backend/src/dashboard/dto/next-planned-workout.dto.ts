export class NextPlannedWorkoutDto {
  workoutDayId: string;
  workoutDayName: string;
  cycleName: string;
  templateName: string | null;
  dayOfWeek: number;
  suggestedDate: string;
  /** Set only when the cycle hasn't started yet -- `suggestedDate` is its first scheduled day. */
  cycleStartDate?: string;
}
