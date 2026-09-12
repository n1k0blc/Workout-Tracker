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
  /** Tagesziele (#152): manual daily targets, each null until the user sets it. */
  targetKcal?: number | null;
  targetCarbs?: number | null;
  targetProtein?: number | null;
  targetFat?: number | null;
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
  // Catalogue equipment of the exercise (§4.1). Optional because older persisted drafts and
  // hand-built fixtures predate it; the active-workout UI reads it to let a BODYWEIGHT set log
  // at 0 kg while keeping the guard for every other exercise.
  equipment?: Equipment;
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
  // Catalogue equipment, carried from the tree / picked exercise so the card's additional-set
  // guard can allow a 0 kg set on a BODYWEIGHT movement. Optional: older persisted drafts and
  // fixtures predate it, and an unknown value simply falls back to the strict guard.
  equipment?: Equipment;
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

// Last-performance lookup (issue #112): the last time the user actually performed an
// exercise, plus which step of the gym cascade it was found on. Drives the swap/add
// prefill in the active workout. `rest` is deliberately absent -- see the endpoint.
export type LastPerformanceSource = 'CURRENT_GYM' | 'HOME_GYM' | 'ANY_GYM';

export interface LastPerformanceSet {
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
}

export interface LastPerformance {
  exerciseId: string;
  source: LastPerformanceSource;
  /** The `localDate` (YYYY-MM-DD) of the workout the values came from. */
  performedOn: string;
  gymId: string | null;
  /** `null` when that workout was logged at "Anderes Gym". */
  gymName: string | null;
  sets: LastPerformanceSet[];
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

// Nutrition Types (#141)

export interface MacroTotals {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/**
 * One logged Eintrag. Its nutrients are a snapshot taken at log time -- a quantity edit
 * rescales them proportionally, they are never recomputed. `foodId` / `mealId` are always
 * null in this ticket (a Schnelleintrag); later tickets attach foods and meals.
 */
export interface DiaryEntry {
  id: string;
  mealSlotId: string;
  localDate: string;
  foodId: string | null;
  /** Set on entries expanded from a Mahlzeit (#147); they group under `mealName`. */
  mealId: string | null;
  /** The meal's name, snapshotted at expansion time (ADR-0002). Null unless `mealId` is set. */
  mealName: string | null;
  name: string;
  quantity: number;
  quantityLabel: string | null;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface NutritionDaySlot {
  id: string;
  name: string;
  order: number;
  /** True for an archived Abschnitt; only returned on days that already have entries in it. */
  archived: boolean;
  totals: MacroTotals;
  entries: DiaryEntry[];
}

export interface MealSlot {
  id: string;
  name: string;
  order: number;
  archived: boolean;
}

export interface MealSlotList {
  /** Active Abschnitte in display order (1-based, contiguous). */
  active: MealSlot[];
  archived: MealSlot[];
}

/**
 * The user's Tagesziele (#152) as the day payload carries them. `null` on {@link NutritionDay}
 * means the user has set none and the client shows plain totals; otherwise each field is the
 * target or `null` if that one is unset.
 */
export interface MacroTargets {
  kcal: number | null;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
}

export interface NutritionDay {
  date: string;
  totals: MacroTotals;
  /** Non-null when at least one Tagesziel is set; drives the consumed-vs-target card. */
  targets: MacroTargets | null;
  slots: NutritionDaySlot[];
}

/** The four metrics the Ernährungs-Analytics chart (#153) can toggle between. */
export type NutritionMetric = 'kcal' | 'carbs' | 'protein' | 'fat';

/** One day of the Ernährungs-Analytics series; a day with no entries has every total at 0. */
export interface NutritionTrendDay {
  date: string;
  /** 0 = Sunday .. 6 = Saturday, for the weekday x-axis labels. */
  weekday: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

/** `GET /nutrition/analytics`: one row per calendar day in `[start, end]`, plus the Tagesziele. */
export interface NutritionTrend {
  start: string;
  end: string;
  days: NutritionTrendDay[];
  targets: MacroTargets | null;
}

export interface CreateDiaryEntryInput {
  mealSlotId: string;
  localDate: string;
  name: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  quantity?: number;
  quantityLabel?: string;
  /** Also save the entered values as a new USER Lebensmittel and link this entry to it. */
  saveAsFood?: boolean;
}

/** One food picked in the drawer; `grams` is already normalized to g / ml. */
export interface DiaryEntryFromFoodInput {
  foodId: string;
  grams: number;
  quantityLabel?: string;
}

export interface DiaryEntriesBatchInput {
  mealSlotId: string;
  localDate: string;
  items: DiaryEntryFromFoodInput[];
}

// Lebensmittel library (#143)

export type FoodSource = 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';

export interface FoodPortion {
  id: string;
  label: string;
  /** Grams, or millilitres when the food is a liquid. */
  grams: number;
  order: number;
  isDefault: boolean;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  isLiquid: boolean;
  /** Per 100 g / 100 ml. */
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  source: FoodSource;
  createdById: string | null;
  /** Soft-deleted: gone from search, still resolves by id. */
  deleted: boolean;
  /** The current user's own, non-deleted USER food -- the only case the editor is writable. */
  editable: boolean;
  /** The current user has starred this food (#148). Floats it up the picker's "Alle" tab. */
  isFavorite: boolean;
  portions: FoodPortion[];
}

/**
 * One capped page of the library plus the totals behind it. The Open Food Facts import (#146)
 * puts ~180k foods in the library, so `items.length` is the page size, never the number of
 * matches -- render the totals, not the page.
 */
export interface FoodList {
  items: Food[];
  /** Foods matching the search, ignoring the page cap. */
  total: number;
  /** How many of `total` are the current user's own editable foods. */
  ownTotal: number;
}

export interface FoodPortionInput {
  label: string;
  grams: number;
  isDefault?: boolean;
}

export interface FoodInput {
  name: string;
  brand?: string;
  barcode?: string;
  isLiquid?: boolean;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portions?: FoodPortionInput[];
}

export interface SimilarFood {
  id: string;
  name: string;
  kcal: number;
  isLiquid: boolean;
  /** How many of the current user's diary entries reference this food. */
  usageCount: number;
}

// Barcode-Scan (#149)

/**
 * Where a scanned barcode landed in the miss chain: `local` -- already in the shared library;
 * `openFoodFacts` -- fetched live and cached as a global food; `notFound` -- neither, so the
 * create form opens with the barcode prefilled.
 */
export type BarcodeLookupStatus = 'local' | 'openFoodFacts' | 'notFound';

export interface BarcodeLookup {
  status: BarcodeLookupStatus;
  /** The code in its canonical form -- a scanned UPC-A comes back widened to an EAN-13. */
  barcode: string;
  /** The resolved food; null only when `status` is `notFound`. */
  food: Food | null;
}

// Mahlzeiten (#147)

/** One ingredient of a Mahlzeit, with the live per-100 values needed to recompute its share. */
export interface MealItem {
  id: string;
  foodId: string;
  order: number;
  /** Grams or millilitres, matching the food's `isLiquid`. */
  quantity: number;
  foodName: string;
  isLiquid: boolean;
  /** The referenced food has been soft-deleted -- it still resolves and still computes. */
  deleted: boolean;
  per100: MacroTotals;
  portions: FoodPortion[];
}

/** A Mahlzeit with its ingredients resolved and totals computed live, per 1x. Editor payload. */
export interface MealDetail {
  id: string;
  name: string;
  /**
   * The caller's own, non-deleted meal -- the only case the editor writes. The sole
   * creator-derived fact exposed; no creator id or name (ADR-0003).
   */
  editable: boolean;
  /** The current user has starred this meal (#148). */
  isFavorite: boolean;
  deleted: boolean;
  items: MealItem[];
  totals: MacroTotals;
}

/** A row in the Mahlzeiten tab / picker list. */
export interface MealListItem {
  id: string;
  name: string;
  editable: boolean;
  /** The current user has starred this meal (#148). Floats it up the picker's "Alle" tab. */
  isFavorite: boolean;
  itemCount: number;
  /** Ingredient names in item order, for the "Reis, Hähnchen, Paprika +3" preview. */
  ingredientNames: string[];
  totals: MacroTotals;
}

export interface MealList {
  items: MealListItem[];
  /** Meals matching the filter. */
  total: number;
  /** How many of `total` the current user created. */
  mineTotal: number;
}

export interface MealItemInput {
  foodId: string;
  /** Grams or millilitres. */
  quantity: number;
}

export interface MealInput {
  name: string;
  items: MealItemInput[];
}

/** Logs a Mahlzeit: the server expands it into one entry per ingredient, scaled by `factor`. */
export interface DiaryEntriesFromMealInput {
  mealSlotId: string;
  localDate: string;
  mealId: string;
  factor: number;
}

// Von einem anderen Tag kopieren (#151)

/** Copy a whole previous day's entries onto `toDate`, each staying in its own Abschnitt. */
export interface CopyDiaryDayInput {
  fromDate: string;
  toDate: string;
}

/** Copy just one Abschnitt's entries from `fromDate` into the same Abschnitt on `toDate`. */
export interface CopyDiarySlotInput {
  fromDate: string;
  toDate: string;
  mealSlotId: string;
}

// Favoriten & Zuletzt (#148)

/**
 * One row of the picker's Favoriten / Zuletzt tab: a Lebensmittel or a Mahlzeit, tagged so
 * the client renders the right row. Foods and meals are interleaved in one ordered array so
 * the tab's ordering (last use / most recent) survives.
 */
export type PickerItem =
  | { kind: 'food'; food: Food }
  | { kind: 'meal'; meal: MealListItem };

export interface PickerList {
  items: PickerItem[];
}
