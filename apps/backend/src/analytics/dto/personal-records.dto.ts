export class PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  type: 'weight' | 'reps' | 'volume' | 'one_rm';
  value: number;
  date: Date;
  workoutId: string;
  details?: {
    weight?: number;
    reps?: number;
    sets?: number;
  };
}

export class PersonalRecordsDto {
  recentPRs: PersonalRecord[]; // Last 30 days
  allTimePRs: PersonalRecord[];
}
