// User Types
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// Auth Types
export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
}

// Exercise Types
export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  ABS = 'ABS',
  SHOULDERS = 'SHOULDERS',
  LEGS = 'LEGS',
}

export enum Equipment {
  CABLE = 'CABLE',
  MACHINE = 'MACHINE',
  DUMBBELL = 'DUMBBELL',
  BARBELL = 'BARBELL',
  BODYWEIGHT = 'BODYWEIGHT',
  SMITH_MACHINE = 'SMITH_MACHINE',
  EZ_BAR = 'EZ_BAR',
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isCustom: boolean;
  userId?: string;
}

// Workout Types
export enum WorkoutStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DISCARDED = 'DISCARDED',
}

export enum SetType {
  WARMUP = 'WARMUP',
  WORKING = 'WORKING',
}

export interface PlannedSet {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  restAfterSet: number;
}

export interface SetLog {
  id: string;
  setNumber: number;
  setType?: SetType;
  reps: number;
  weight: number;
  rir?: number;
  targetReps?: number;
  targetWeight?: number;
  targetRir?: number;
  completedAt: string;
  actualRestDuration?: number;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: SetLog[];
  plannedSets?: PlannedSet[];
}

export type GymLocation = 'HOME' | 'OTHER';

export interface Workout {
  id: string;
  date: string;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  gymLocation: GymLocation;
  cycleId?: string;
  cycleName?: string;
  workoutDayId?: string;
  workoutDayName?: string;
  exercises: ExerciseLog[];
  createdAt: string;
}

export interface WorkoutListItem {
  id: string;
  date: string;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  gymLocation: GymLocation;
  cycleName?: string;
  workoutDayName?: string;
  exerciseCount: number;
  createdAt: string;
}

// Cycle Types
export interface BlueprintSet {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  restAfterSet: number;
}

export interface BlueprintExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: BlueprintSet[];
}

export interface WorkoutBlueprint {
  id: string;
  exercises: BlueprintExercise[];
  updatedAt: string;
}

export interface WorkoutDay {
  id: string;
  weekday: number;
  name: string;
  blueprint?: WorkoutBlueprint;
}

export interface WorkoutCycle {
  id: string;
  name: string;
  duration: number;
  startDate: string;
  createdAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt?: string;
  workoutDays: WorkoutDay[];
}

// Analytics Types
export interface VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
}

export interface VolumeByMuscleGroup {
  muscleGroup: string;
  volume: number;
  percentage: number;
}

export interface VolumeAnalytics {
  totalVolume: number;
  period: string;
  dataPoints: VolumeDataPoint[];
  byMuscleGroup?: VolumeByMuscleGroup[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  type: 'weight' | 'reps' | 'volume' | 'one_rm';
  value: number;
  date: string;
  workoutId: string;
  details?: {
    weight?: number;
    reps?: number;
    sets?: number;
  };
}

export interface PersonalRecordsResponse {
  recentPRs: PersonalRecord[];
  allTimePRs: PersonalRecord[];
}
