// User Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  createdAt: string;
  homeGyms?: HomeGym[];
}

export interface HomeGym {
  id: string;
  name: string;
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
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  height: number; // cm
  weight: number; // kg
  homeGyms: { name: string }[];
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
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  isCustom: boolean;
  userId?: string;
}

export interface UpdateExerciseDto {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
}

export interface ExerciseBenchmark {
  id: string;
  cycleId: string;
  workoutDayId: string;
  exerciseId: string;
  ormBenchmark: number;
  setAtWorkoutId: string;
  createdAt: string;
}

export interface ORMAnalytics {
  workouts: {
    workoutId: string;
    date: string;
    exercises: {
      exerciseId: string;
      exerciseName: string;
      benchmark: number;
      percentORM: number | null;
      wasBenchmarkSet: boolean;
    }[];
  }[];
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
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
  order: number;
  sets: SetLog[];
  plannedSets?: PlannedSet[];
}

export interface Workout {
  id: string;
  date: string;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  homeGymId?: string | null;
  homeGym?: HomeGym;
  plannedHomeGymId?: string | null;
  cycleId?: string;
  cycleName?: string;
  workoutDayId?: string;
  workoutDayName?: string;
  templateId?: string;
  templateName?: string;
  exercises: ExerciseLog[];
  createdAt: string;
}

export interface WorkoutListItem {
  id: string;
  date: string;
  status: WorkoutStatus;
  isFreeWorkout: boolean;
  totalDuration?: number;
  totalVolume: number;
  homeGymId?: string | null;
  homeGym?: HomeGym;
  cycleName?: string;
  workoutDayName?: string;
  workoutDayWeekday?: number;
  templateId?: string;
  templateName?: string;
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
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
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
  plannedHomeGymId?: string;
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

export interface WorkoutsByGym {
  gymName: string;
  count: number;
  isHome: boolean;
}

export interface CycleDetails {
  // Basic cycle info
  id: string;
  name: string;
  duration: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt?: string;

  // Statistics
  totalVolume: number;
  workoutCount: number;
  workoutsByGym: WorkoutsByGym[];

  // Current week (for active cycles)
  currentWeek?: number;
  totalWeeks?: number;
  percentage?: number;
}

// Analytics Types
export interface VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
  trainingDay?: number;
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
  isUnilateral: boolean;
  isDoubleWeight: boolean;
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

export interface CycleListItem {
  id: string;
  name: string;
  duration: number;
  startDate: string;
  status: 'ACTIVE' | 'COMPLETED';
  completedAt?: string;
  createdAt: string;
}

export interface CycleList {
  activeCycle?: CycleListItem;
  completedCycles: CycleListItem[];
}

export interface ORMDataPoint {
  date: string;
  trainingDay: number;
  percentORM: number;
  workoutId: string;
}

export interface ORMByCycleAnalytics {
  cycleId: string;
  cycleName: string;
  dataPoints: ORMDataPoint[];
  averagePercentORM: number;
  totalWorkouts: number;
}

export interface RIRDataPoint {
  date: string;
  trainingDay: number;
  rir0Count: number;
  rir1Count: number;
  rir2Count: number;
  workoutId: string;
}

export interface RIRByCycleAnalytics {
  cycleId: string;
  cycleName: string;
  dataPoints: RIRDataPoint[];
  totalSets: number;
  totalWorkouts: number;
}

export interface RIRAnalyticsDataPoint {
  date: string;
  rir0Count: number;
  rir1Count: number;
  rir2Count: number;
  workoutId: string;
}

export interface RIRAnalytics {
  totalSets: number;
  period: string;
  dataPoints: RIRAnalyticsDataPoint[];
}

export interface DurationDataPoint {
  date: string;
  duration: number;
  workoutId: string;
  trainingDay?: number;
}

export interface DurationAnalytics {
  averageDuration: number;
  period: string;
  dataPoints: DurationDataPoint[];
}

export interface DurationByCycleAnalytics {
  cycleId: string;
  cycleName: string;
  dataPoints: DurationDataPoint[];
  averageDuration: number;
  totalWorkouts: number;
}

export interface RestTimeDataPoint {
  date: string;
  averageRestTime: number;
  workoutId: string;
  trainingDay?: number;
}

export interface RestTimeAnalytics {
  overallAverage: number;
  period: string;
  dataPoints: RestTimeDataPoint[];
}

export interface RestTimeByCycleAnalytics {
  cycleId: string;
  cycleName: string;
  dataPoints: RestTimeDataPoint[];
  overallAverage: number;
  totalWorkouts: number;
}

export interface RepsDataPoint {
  date: string;
  reps: number;
  workoutId: string;
  trainingDay?: number;
}

export interface RepsAnalytics {
  totalReps: number;
  averageReps: number;
  period: string;
  dataPoints: RepsDataPoint[];
}

export interface RepsByCycleAnalytics {
  cycleId: string;
  cycleName: string;
  dataPoints: RepsDataPoint[];
  totalReps: number;
  averageReps: number;
  totalWorkouts: number;
}

// Workout Template Types
export interface WorkoutTemplateSet {
  id: string;
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

export interface WorkoutTemplateExercise {
  id: string;
  order: number;
  exerciseId: string;
  exerciseName?: string;
  sets: WorkoutTemplateSet[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  isCustom: boolean;
  userId?: string;
  recommendedGymId?: string;
  recommendedGymName?: string;
  createdAt: string;
  exercises?: WorkoutTemplateExercise[];
  totalExercises?: number;
  totalSets?: number;
}

export interface CreateWorkoutTemplateSet {
  order: number;
  isWarmup: boolean;
  targetReps: number;
  targetWeight: number;
  targetRir: number;
}

export interface CreateWorkoutTemplateExercise {
  exerciseId: string;
  order: number;
  sets: CreateWorkoutTemplateSet[];
}

export interface CreateWorkoutTemplate {
  name: string;
  recommendedGymId?: string;
  exercises: CreateWorkoutTemplateExercise[];
}

export interface UpdateWorkoutTemplate {
  name?: string;
  recommendedGymId?: string;
  exercises?: CreateWorkoutTemplateExercise[];
}

// Dashboard Types
export interface CurrentWeekStats {
  workouts: number;
  volume: number;
  averageDuration: number | null;
}

export interface LastWeekStats {
  volume: number;
}

export interface DashboardStats {
  currentWeek: CurrentWeekStats;
  lastWeek: LastWeekStats;
  volumeChange: number;
}

export interface NextPlannedWorkout {
  workoutDayId: string;
  workoutDayName: string;
  cycleName: string;
  templateName: string | null;
  dayOfWeek: number;
  suggestedDate: string;
}

export interface CycleProgress {
  currentWeek: number;
  totalWeeks: number;
  percentage: number;
  cycleName: string;
}
