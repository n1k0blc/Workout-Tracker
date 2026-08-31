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
// PR2 (§3.7): the 12-column percent distribution is the source of truth. `primaryMuscle` is
// derived server-side (max-percent column), not a stored field -- no more coarse BACK/ABS/LEGS.
export enum MuscleGroup {
  ABDOMEN = 'ABDOMEN',
  LATISSIMUS = 'LATISSIMUS',
  TRAPEZIUS = 'TRAPEZIUS',
  LOWER_BACK = 'LOWER_BACK',
  HAMSTRINGS = 'HAMSTRINGS',
  GLUTES = 'GLUTES',
  SHOULDERS = 'SHOULDERS',
  BICEPS = 'BICEPS',
  CHEST = 'CHEST',
  QUADRICEPS = 'QUADRICEPS',
  CALVES = 'CALVES',
  TRICEPS = 'TRICEPS',
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
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  isUnilateral: boolean;
  isDoubleWeight: boolean;
  isCustom: boolean;
  userId?: string;
  // True when any WorkoutSet references this exercise (any workout kind). Locks the
  // isUnilateral toggle in the editor -- see issue #98.
  inUse: boolean;
  // Muscle group distribution percentages
  abdomenPercent: number;
  latissimusPercent: number;
  trapeziusPercent: number;
  lowerBackPercent: number;
  hamstringsPercent: number;
  glutesPercent: number;
  shouldersPercent: number;
  bicepsPercent: number;
  chestPercent: number;
  quadricepsPercent: number;
  calvesPercent: number;
  tricepsPercent: number;
}

export interface UpdateExerciseDto {
  name: string;
  primaryMuscle?: MuscleGroup;
  equipment: Equipment;
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
  // Muscle group distribution percentages (optional for updates)
  abdomenPercent?: number;
  latissimusPercent?: number;
  trapeziusPercent?: number;
  lowerBackPercent?: number;
  hamstringsPercent?: number;
  glutesPercent?: number;
  shouldersPercent?: number;
  bicepsPercent?: number;
  chestPercent?: number;
  quadricepsPercent?: number;
  calvesPercent?: number;
  tricepsPercent?: number;
}

// Workout tree types.
// `WorkoutExercise`/`WorkoutSet` mirror the backend wire shape exactly (§3.2/§4.1) and are used
// for the blueprint/template tree (read-only from the client's perspective) and as the payload
// shape for the final save.
// `ExerciseLog`/`SetLog`/`PlannedSet` are the CLIENT-side working model for an in-progress/edited
// workout draft: `plannedSets` is a local-only "suggested, not yet confirmed" list (sourced from
// the blueprint/template at draft-build time, never sent to the backend), while `sets` holds the
// sets the user has actually confirmed/logged. This mirrors the pre-PR2 shape deliberately (field
// renames only: `restAfterSet`/`actualRestDuration` -> `rest`, dropped `target*`) so the existing
// exercise-card UI (swipe-to-log, planned-vs-logged rendering) needed no structural rewrite.
export enum SetType {
  WARMUP = 'WARMUP',
  WORKING = 'WORKING',
}

export interface WorkoutSet {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number;
  // Per-side values for unilateral sets (§4.1, issue #65/#97). Present on historical
  // unilateral sets via the backfill; null/absent for bilateral sets. Round-tripped only
  // for now -- reps/weight/rir stay the aggregates every existing surface reads.
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  rest?: number; // seconds rested after completing this set
  completedAt?: string; // meaningful only for performed workouts
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  isUnilateral?: boolean;
  isDoubleWeight?: boolean;
  order: number;
  sets: WorkoutSet[];
}

export interface PlannedSet {
  id: string;
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir: number;
  // Per-side targets for a unilateral exercise's planned set (issue #103). Present once a
  // plan has been overwritten from a performed workout (or edited per side); absent on
  // legacy plans backfilled symmetrically, where reps/weight/rir carry both sides. The
  // aggregates stay in sync with the sides -- reps=round(avg), weight=avg, rir=min.
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  rest: number;
}

export interface SetLog {
  id: string;
  setNumber: number;
  setType?: SetType;
  reps: number;
  weight: number;
  rir?: number;
  // Per-side values for unilateral sets (§4.1, issue #65/#97). Present on historical
  // unilateral sets via the backfill; null/absent for bilateral sets. Read-only views
  // render both sides from these (issue #101).
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  completedAt: string;
  /** Seconds rested after completing this set -- assigned when the NEXT set (anywhere in the
   *  workout) completes, or defaulted to the planned/90 value at save time for the last set. */
  rest?: number;
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
  /**
   * The calendar day the workout happened on in the user's timezone, `YYYY-MM-DD`.
   * Fixed at log time, so "which day was this?" never depends on where it is asked from.
   */
  localDate: string;
  isFreeWorkout: boolean;
  totalDuration?: number;
  homeGymId?: string | null;
  homeGym?: HomeGym;
  plannedHomeGymId?: string | null;
  cycleId?: string;
  cycleName?: string;
  workoutDayId?: string;
  workoutDayName?: string;
  originTemplateId?: string;
  originTemplateName?: string;
  originTemplateIsCustom?: boolean;
  exercises: ExerciseLog[];
  createdAt: string;
}

export interface WorkoutListItem {
  id: string;
  date: string;
  isFreeWorkout: boolean;
  totalDuration?: number;
  totalVolume: number;
  homeGymId?: string | null;
  homeGym?: HomeGym;
  cycleName?: string;
  workoutDayName?: string;
  workoutDayWeekday?: number;
  originTemplateId?: string;
  originTemplateName?: string;
  exerciseCount: number;
  createdAt: string;
}

// Save-workout DTOs (§3.4): the single transactional save, with side-effect flags.
export enum SaveAsTemplateMode {
  NONE = 'none',
  NEW = 'new',
  OVERWRITE = 'overwrite',
}

export interface WorkoutSetInput {
  order: number;
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number;
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
  rest?: number;
  completedAt?: string;
}

export interface WorkoutExerciseInput {
  exerciseId: string;
  order: number;
  sets: WorkoutSetInput[];
}

export interface SaveWorkoutDto {
  date: string;
  localDate: string;
  totalDuration?: number;
  isFreeWorkout?: boolean;
  homeGymId?: string;
  cycleId?: string;
  workoutDayId?: string;
  originTemplateId?: string;
  exercises: WorkoutExerciseInput[];
  overwriteBlueprint?: boolean;
  saveAsTemplateMode?: SaveAsTemplateMode;
  saveAsTemplateName?: string;
  overwriteTemplateId?: string;
}

// Cycle Types
export interface WorkoutDay {
  id: string;
  weekday: number;
  order: number;
  name: string;
  plannedHomeGymId?: string;
  blueprint?: {
    id: string;
    updatedAt: string;
    exercises: WorkoutExercise[];
  };
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

// Analytics Types (PR3 §3.9: `cycleId` presence alone switches a metric into cycle-anchored
// mode -- there's no separate "-by-cycle" type/endpoint anymore, just optional cycle/week fields)
export interface AnalyticsFilterParams {
  period?: 'week' | 'month' | 'all';
  startDate?: string;
  endDate?: string;
  gymId?: string;
  muscleGroup?: string | string[];
  equipment?: string | string[];
  cycleId?: string;
  aggregation?: 'day' | 'week';
  exerciseId?: string;
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
  workoutId?: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface VolumeByMuscleGroup {
  muscleGroup: string;
  volume: number;
  percentage: number;
}

export interface VolumeAnalytics {
  cycleId?: string;
  cycleName?: string;
  totalVolume: number;
  period?: string;
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
  /** Gym where this PR was achieved (null = "Anderes Gym") */
  homeGym?: { id: string; name: string } | null;
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

export interface RIRDataPoint {
  date: string;
  trainingDay?: number;
  rir0Count: number;
  rir1Count: number;
  rir2Count: number;
  workoutId: string;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface RIRAnalytics {
  cycleId?: string;
  cycleName?: string;
  totalSets: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: RIRDataPoint[];
}

export interface DurationDataPoint {
  date: string;
  duration: number;
  workoutId: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface DurationAnalytics {
  cycleId?: string;
  cycleName?: string;
  averageDuration: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: DurationDataPoint[];
}

export interface RestTimeDataPoint {
  date: string;
  averageRestTime: number;
  workoutId: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface RestTimeAnalytics {
  cycleId?: string;
  cycleName?: string;
  overallAverage: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: RestTimeDataPoint[];
}

export interface RepsDataPoint {
  date: string;
  reps: number;
  workoutId: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface RepsAnalytics {
  cycleId?: string;
  cycleName?: string;
  totalReps: number;
  averageReps: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: RepsDataPoint[];
}

export interface SetsDataPoint {
  date: string;
  sets: number;
  workoutId: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface SetsAnalytics {
  cycleId?: string;
  cycleName?: string;
  totalSets: number;
  averageSets: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: SetsDataPoint[];
}

// PR3 §3.10: ORM% reborn weight-independent (`3000 / (30 + reps + rir)` per working set,
// averaged) -- applies to every gym/workout, unlike the retired benchmark-based %ORM.
export interface IntensityDataPoint {
  date: string;
  intensity: number;
  workoutId: string;
  trainingDay?: number;
  weekNumber?: number;
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  workoutCount?: number;
}

export interface IntensityAnalytics {
  cycleId?: string;
  cycleName?: string;
  averageIntensity: number;
  period?: string;
  totalWorkouts: number;
  dataPoints: IntensityDataPoint[];
}

// Workout Template Types (same tree shape as blueprints/workouts, §3.2)
export interface WorkoutTemplate {
  id: string;
  name: string;
  isCustom: boolean;
  userId?: string;
  recommendedGymId?: string;
  recommendedGymName?: string;
  createdAt: string;
  exercises?: WorkoutExercise[];
  totalExercises?: number;
  totalSets?: number;
}

export interface CreateWorkoutTemplate {
  name: string;
  recommendedGymId?: string;
  exercises: WorkoutExerciseInput[];
}

export interface UpdateWorkoutTemplate {
  name?: string;
  recommendedGymId?: string;
  exercises?: WorkoutExerciseInput[];
}

// Dashboard Types
export interface LastSevenDaysStats {
  workouts: number;
  volume: number;
  averageDuration: number | null;
}

export interface PreviousSevenDaysStats {
  volume: number;
}

export interface DashboardStats {
  lastSevenDays: LastSevenDaysStats;
  previousSevenDays: PreviousSevenDaysStats;
  volumeChange: number;
}

export interface NextPlannedWorkout {
  workoutDayId: string;
  workoutDayName: string;
  cycleName: string;
  templateName: string | null;
  dayOfWeek: number;
  suggestedDate: string;
  /** Set only when the cycle hasn't started yet -- `suggestedDate` is its first scheduled day. */
  cycleStartDate?: string;
}

export interface CycleProgress {
  currentWeek: number;
  totalWeeks: number;
  percentage: number;
  cycleName: string;
}

// Suggested workout / current-cycle-workouts (workout-engine)
export interface SuggestedWorkout {
  cycleId: string;
  cycleName: string;
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  plannedHomeGymId?: string | null;
  exercises: WorkoutExercise[];
}

export interface CycleWorkoutDay {
  workoutDayId: string;
  workoutDayName: string;
  weekday: number;
  isSuggested: boolean;
  exerciseCount: number;
}

export interface CurrentCycleWorkouts {
  cycleId: string;
  cycleName: string;
  workoutDays: CycleWorkoutDay[];
}
