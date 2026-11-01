import { PrismaClient } from '../../../generated/prisma/client';
import { getCurrentDate } from '../utils/date.util';
import { resolveToday } from '../utils/today.util';
import {
  AGE_MAX,
  AGE_MIN,
  BODY_WEIGHT_KG_MAX,
  BODY_WEIGHT_KG_MIN,
  EMAIL_MAX,
  FORBIDDEN_TEXT_PATTERN,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  HOME_GYMS_MAX,
  NAME_MAX,
  PERSON_NAME_MAX,
  PERSON_NAME_PATTERN,
  ageOn,
} from './field-rules';

/**
 * Read-only audit of existing rows against the input rules of #221. The logic behind
 * `npm run check:input-rules` (scripts/check-input-rules.ts); it only ever calls `findMany`.
 *
 * Editing a workout resends its whole tree through `replaceTree`, so an old row that breaks a
 * rule the server is about to enforce would make that workout impossible to save. Every row
 * that does is reported here, before the rules go live.
 *
 * A violation is either `fixedByMigration` (the data migration
 * `20261101120000_normalize_input_rules_data` corrects it) or it needs a decision by hand.
 */

export interface InputRuleViolation {
  category: string;
  table: string;
  id: string;
  field: string;
  message: string;
  /** True when the data migration corrects this row; false when it has to be fixed by hand. */
  fixedByMigration: boolean;
}

const BATCH = 1000;

/** Streams every row of a model, `BATCH` at a time, in id order. */
async function* rowsOf<T extends { id: string }>(
  fetch: (page: { take: number; skip?: number; cursor?: { id: string } }) => Promise<T[]>,
): AsyncGenerator<T> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await fetch({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    yield* batch;
    if (batch.length < BATCH) return;
    cursor = batch[batch.length - 1].id;
  }
}

type Report = (violation: InputRuleViolation) => void;

/** Tagesziele limits (kcal / macros in grams). Not yet in field-rules.ts: the Profil ticket adds them there. */
const TARGET_KCAL_MIN = 500;
const TARGET_KCAL_MAX = 10000;
const TARGET_MACRO_MIN = 1;
const TARGET_MACRO_MAX = 1000;

// Limits of #221 that no DTO has declared yet; the ticket that adds each rule moves its number
// into field-rules.ts (which the frontend mirrors) and this file imports it from there.
const TRAINING_DAY_NAME_MAX = 50;
const FOOD_NAME_MAX = 120;
const SECTION_NAME_MAX = 60;
const PORTION_LABEL_MAX = 60;
const CYCLE_DURATION_MIN = 1;
const CYCLE_DURATION_MAX = 52;
const EXERCISES_PER_WORKOUT_MAX = 30;
const SETS_PER_EXERCISE_MAX = 20;
const PORTIONS_PER_FOOD_MAX = 10;
const SECTIONS_PER_USER_MAX = 10;
const WEIGHT_KG_MAX = 1000;
const REPS_MIN = 1;
const REPS_MAX = 100;
const RIR_MIN = 0;
const RIR_MAX = 10;
const KCAL_PER_100_MAX = 900;
const MACRO_PER_100_MAX = 100;
const QUICK_ENTRY_KCAL_MAX = 10000;
const QUICK_ENTRY_MACRO_MAX = 1000;
const AMOUNT_MIN = 0.1;
const AMOUNT_MAX = 5000;
/** Performed workouts may not predate this day. */
const WORKOUT_DATE_MIN = new Date('2000-01-01T00:00:00.000Z');
/** `Workout.date` is an instant; a day of slack keeps a zone ahead of the server from reading as "future". */
const WORKOUT_DATE_FUTURE_GRACE_MS = 24 * 60 * 60 * 1000;

interface TextRule {
  max: number;
  /** A required text must not be empty once trimmed. Optional columns skip null. */
  required?: boolean;
  personName?: boolean;
}

/**
 * The base text rule of #221 against one stored value. Surrounding whitespace is the one thing
 * the migration corrects (the server trims on the way in), so the remaining rules are judged on
 * the trimmed value, as they will be once the row is resent.
 */
function checkText(
  table: string,
  id: string,
  field: string,
  value: string | null,
  rule: TextRule,
  report: Report,
) {
  if (value === null) return;
  const at = { table, id, field };
  const trimmed = value.trim();

  if (trimmed !== value) {
    report({
      ...at,
      category: 'text-not-trimmed',
      message: 'has leading or trailing whitespace',
      fixedByMigration: true,
    });
  }
  if (rule.required && trimmed.length === 0) {
    report({ ...at, category: 'text-empty', message: 'is empty', fixedByMigration: false });
  }
  if (trimmed.length > rule.max) {
    report({
      ...at,
      category: 'text-too-long',
      message: `is ${trimmed.length} characters; the limit is ${rule.max}`,
      fixedByMigration: false,
    });
  }
  if (FORBIDDEN_TEXT_PATTERN.test(trimmed)) {
    report({
      ...at,
      category: 'control-characters',
      message: 'contains control or zero-width characters',
      fixedByMigration: false,
    });
  }
  if (rule.personName && trimmed.length > 0 && !PERSON_NAME_PATTERN.test(trimmed)) {
    report({
      ...at,
      category: 'invalid-person-name',
      message: `"${trimmed}" is not a person name (letters, spaces, apostrophes, periods, hyphens)`,
      fixedByMigration: false,
    });
  }
}

function checkRange(
  table: string,
  id: string,
  field: string,
  value: number | null,
  min: number,
  max: number,
  report: Report,
) {
  if (value === null || (value >= min && value <= max)) return;
  report({
    table,
    id,
    field,
    category: 'out-of-range',
    message: `is ${value}; allowed ${min} to ${max}`,
    fixedByMigration: false,
  });
}

/** Case-insensitive duplicates make the lowercasing migration impossible, so they are reported first. */
function checkEmails(users: { id: string; email: string }[], report: Report) {
  const byAddress = new Map<string, string[]>();
  for (const { id, email } of users) {
    const key = email.trim().toLowerCase();
    byAddress.set(key, [...(byAddress.get(key) ?? []), id]);
  }
  for (const [address, ids] of byAddress) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      report({
        category: 'email-case-duplicate',
        table: 'User',
        id,
        field: 'email',
        message: `"${address}" is held by ${ids.length} accounts (${ids.join(', ')}); merge or delete all but one. The migration aborts until then`,
        fixedByMigration: false,
      });
    }
  }
}

async function checkUsers(db: PrismaClient, report: Report) {
  const users: { id: string; email: string }[] = [];
  const today = resolveToday(undefined, getCurrentDate()).localDate;

  for await (const user of rowsOf((page) =>
    db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        height: true,
        weight: true,
        targetKcal: true,
        targetCarbs: true,
        targetProtein: true,
        targetFat: true,
      },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    users.push(user);

    if (user.email !== user.email.trim().toLowerCase()) {
      report({
        category: 'email-not-lowercase',
        table: 'User',
        id: user.id,
        field: 'email',
        message: `"${user.email}" is not trimmed and lowercase`,
        fixedByMigration: true,
      });
    }
    checkText(
      'User',
      user.id,
      'email',
      user.email.trim().toLowerCase(),
      { max: EMAIL_MAX, required: true },
      report,
    );
    checkText(
      'User',
      user.id,
      'firstName',
      user.firstName,
      { max: PERSON_NAME_MAX, required: true, personName: true },
      report,
    );
    checkText(
      'User',
      user.id,
      'lastName',
      user.lastName,
      { max: PERSON_NAME_MAX, required: true, personName: true },
      report,
    );

    if (user.dateOfBirth) {
      const age = ageOn(user.dateOfBirth.toISOString(), today);
      if (age < AGE_MIN || age > AGE_MAX) {
        report({
          category: 'invalid-birth-date',
          table: 'User',
          id: user.id,
          field: 'dateOfBirth',
          message: `${user.dateOfBirth.toISOString().slice(0, 10)} makes the age ${age}; allowed ${AGE_MIN} to ${AGE_MAX}`,
          fixedByMigration: false,
        });
      }
    }
    checkRange('User', user.id, 'height', user.height, HEIGHT_CM_MIN, HEIGHT_CM_MAX, report);
    checkRange(
      'User',
      user.id,
      'weight',
      user.weight,
      BODY_WEIGHT_KG_MIN,
      BODY_WEIGHT_KG_MAX,
      report,
    );
    checkRange(
      'User',
      user.id,
      'targetKcal',
      user.targetKcal,
      TARGET_KCAL_MIN,
      TARGET_KCAL_MAX,
      report,
    );
    for (const macro of ['targetCarbs', 'targetProtein', 'targetFat'] as const) {
      checkRange('User', user.id, macro, user[macro], TARGET_MACRO_MIN, TARGET_MACRO_MAX, report);
    }
  }

  checkEmails(users, report);
}

/** Counts rows per parent and reports each parent holding more than `max`. */
class ChildCounter {
  private readonly counts = new Map<string, number>();

  add(parentId: string) {
    this.counts.set(parentId, (this.counts.get(parentId) ?? 0) + 1);
  }

  report(report: Report, table: string, field: string, max: number) {
    for (const [id, count] of this.counts) {
      if (count <= max) continue;
      report({
        category: 'too-many-rows',
        table,
        id,
        field,
        message: `holds ${count} ${field}; the limit is ${max}`,
        fixedByMigration: false,
      });
    }
  }
}

/** GS1 check digit for EAN-8, UPC-A (12) and EAN-13: weights 3,1,3,... from the digit left of the check digit. */
export function isValidEan(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop() as number;
  const sum = digits
    .reverse()
    .reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

async function checkHomeGyms(db: PrismaClient, report: Report) {
  const perUser = new ChildCounter();
  for await (const gym of rowsOf((page) =>
    db.homeGym.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, userId: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText('HomeGym', gym.id, 'name', gym.name, { max: NAME_MAX, required: true }, report);
    perUser.add(gym.userId);
  }
  perUser.report(report, 'User', 'homeGyms', HOME_GYMS_MAX);
}

async function checkCycles(db: PrismaClient, report: Report) {
  const activeByUser = new Map<string, string[]>();
  for await (const cycle of rowsOf((page) =>
    db.workoutCycle.findMany({
      select: { id: true, userId: true, name: true, duration: true, status: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText(
      'WorkoutCycle',
      cycle.id,
      'name',
      cycle.name,
      { max: NAME_MAX, required: true },
      report,
    );
    checkRange(
      'WorkoutCycle',
      cycle.id,
      'duration',
      cycle.duration,
      CYCLE_DURATION_MIN,
      CYCLE_DURATION_MAX,
      report,
    );
    if (cycle.status === 'ACTIVE') {
      activeByUser.set(cycle.userId, [...(activeByUser.get(cycle.userId) ?? []), cycle.id]);
    }
  }
  for (const [userId, ids] of activeByUser) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      report({
        category: 'multiple-active-cycles',
        table: 'WorkoutCycle',
        id,
        field: 'status',
        message: `user ${userId} has ${ids.length} active Zyklen (${ids.join(', ')}); complete or delete all but one`,
        fixedByMigration: false,
      });
    }
  }
}

async function checkWorkoutDays(db: PrismaClient, report: Report) {
  for await (const day of rowsOf((page) =>
    db.workoutDay.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' }, ...page }),
  )) {
    checkText(
      'WorkoutDay',
      day.id,
      'name',
      day.name,
      { max: TRAINING_DAY_NAME_MAX, required: true },
      report,
    );
  }
}

async function checkWorkouts(db: PrismaClient, report: Report) {
  const templatesByName = new Map<string, string[]>();
  const latest = Date.now() + WORKOUT_DATE_FUTURE_GRACE_MS;

  for await (const workout of rowsOf((page) =>
    db.workout.findMany({
      select: { id: true, kind: true, userId: true, name: true, date: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    if (workout.kind === 'TEMPLATE') {
      checkText(
        'Workout',
        workout.id,
        'name',
        workout.name,
        { max: NAME_MAX, required: true },
        report,
      );
      if (workout.userId && workout.name !== null) {
        const key = `${workout.userId}\u0000${workout.name.trim()}`;
        templatesByName.set(key, [...(templatesByName.get(key) ?? []), workout.id]);
      }
    }
    if (
      workout.kind === 'WORKOUT' &&
      workout.date &&
      (workout.date < WORKOUT_DATE_MIN || workout.date.getTime() > latest)
    ) {
      report({
        category: 'invalid-workout-date',
        table: 'Workout',
        id: workout.id,
        field: 'date',
        message: `${workout.date.toISOString()} is before 2000-01-01 or in the future`,
        fixedByMigration: false,
      });
    }
  }

  // Trimming a template name can make it equal to a sibling's, which the per-user unique index forbids.
  for (const [key, ids] of templatesByName) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      report({
        category: 'template-name-collision',
        table: 'Workout',
        id,
        field: 'name',
        message: `"${key.split('\u0000')[1]}" is held by ${ids.length} templates of one user once trimmed (${ids.join(', ')}); rename all but one. The migration aborts until then`,
        fixedByMigration: false,
      });
    }
  }

  const exercisesByWorkout = new ChildCounter();
  for await (const exercise of rowsOf((page) =>
    db.workoutExercise.findMany({
      select: { id: true, workoutId: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    exercisesByWorkout.add(exercise.workoutId);
  }
  exercisesByWorkout.report(report, 'Workout', 'exercises', EXERCISES_PER_WORKOUT_MAX);
}

async function checkSets(db: PrismaClient, report: Report) {
  const setsByExercise = new ChildCounter();
  for await (const set of rowsOf((page) =>
    db.workoutSet.findMany({
      select: {
        id: true,
        workoutExerciseId: true,
        setType: true,
        reps: true,
        repsLeft: true,
        repsRight: true,
        weight: true,
        weightLeft: true,
        weightRight: true,
        rir: true,
        rirLeft: true,
        rirRight: true,
      },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    setsByExercise.add(set.workoutExerciseId);

    for (const field of ['weight', 'weightLeft', 'weightRight'] as const) {
      checkRange('WorkoutSet', set.id, field, set[field], 0, WEIGHT_KG_MAX, report);
    }
    for (const field of ['reps', 'repsLeft', 'repsRight'] as const) {
      checkRange('WorkoutSet', set.id, field, set[field], REPS_MIN, REPS_MAX, report);
    }
    for (const field of ['rir', 'rirLeft', 'rirRight'] as const) {
      checkRange('WorkoutSet', set.id, field, set[field], RIR_MIN, RIR_MAX, report);
      if (set.setType === 'WARMUP' && set[field] !== null) {
        report({
          category: 'warm-up-rir',
          table: 'WorkoutSet',
          id: set.id,
          field,
          message: `warm-up set has ${field} ${set[field]}; warm-ups carry no RIR`,
          fixedByMigration: true,
        });
      }
    }
  }
  setsByExercise.report(report, 'WorkoutExercise', 'sets', SETS_PER_EXERCISE_MAX);
}

async function checkExercises(db: PrismaClient, report: Report) {
  for await (const exercise of rowsOf((page) =>
    db.exercise.findMany({
      where: { isCustom: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText(
      'Exercise',
      exercise.id,
      'name',
      exercise.name,
      { max: NAME_MAX, required: true },
      report,
    );
  }
}

/** Only `USER` foods go through the rules; seed and Open Food Facts rows are never resent by a user. */
async function checkFoods(db: PrismaClient, report: Report) {
  for await (const food of rowsOf((page) =>
    db.food.findMany({
      where: { source: 'USER', deletedAt: null },
      select: {
        id: true,
        name: true,
        brand: true,
        barcode: true,
        kcal: true,
        carbs: true,
        protein: true,
        fat: true,
      },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText('Food', food.id, 'name', food.name, { max: FOOD_NAME_MAX, required: true }, report);
    checkText('Food', food.id, 'brand', food.brand, { max: FOOD_NAME_MAX }, report);
    checkRange('Food', food.id, 'kcal', food.kcal, 0, KCAL_PER_100_MAX, report);
    for (const macro of ['carbs', 'protein', 'fat'] as const) {
      checkRange('Food', food.id, macro, food[macro], 0, MACRO_PER_100_MAX, report);
    }
    const macroSum = food.carbs + food.protein + food.fat;
    if (macroSum > MACRO_PER_100_MAX + 1e-9) {
      report({
        category: 'macro-sum',
        table: 'Food',
        id: food.id,
        field: 'carbs',
        message: `carbs + protein + fat is ${macroSum} g per 100 g; the limit is ${MACRO_PER_100_MAX}`,
        fixedByMigration: false,
      });
    }
    if (food.barcode !== null && !isValidEan(food.barcode)) {
      report({
        category: 'invalid-barcode',
        table: 'Food',
        id: food.id,
        field: 'barcode',
        message: `"${food.barcode}" is not an EAN-8, UPC-A or EAN-13 with a valid check digit`,
        fixedByMigration: false,
      });
    }
  }

  const portionsByFood = new ChildCounter();
  for await (const portion of rowsOf((page) =>
    db.foodPortion.findMany({
      where: { food: { source: 'USER', deletedAt: null } },
      select: { id: true, foodId: true, label: true, grams: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText(
      'FoodPortion',
      portion.id,
      'label',
      portion.label,
      { max: PORTION_LABEL_MAX, required: true },
      report,
    );
    checkRange('FoodPortion', portion.id, 'grams', portion.grams, AMOUNT_MIN, AMOUNT_MAX, report);
    portionsByFood.add(portion.foodId);
  }
  portionsByFood.report(report, 'Food', 'portions', PORTIONS_PER_FOOD_MAX);
}

async function checkMeals(db: PrismaClient, report: Report) {
  for await (const meal of rowsOf((page) =>
    db.meal.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText('Meal', meal.id, 'name', meal.name, { max: FOOD_NAME_MAX, required: true }, report);
  }
  for await (const item of rowsOf((page) =>
    db.mealItem.findMany({
      where: { meal: { deletedAt: null } },
      select: { id: true, quantity: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkRange('MealItem', item.id, 'quantity', item.quantity, AMOUNT_MIN, AMOUNT_MAX, report);
  }
}

async function checkDiary(db: PrismaClient, report: Report) {
  const slotsByUser = new ChildCounter();
  for await (const slot of rowsOf((page) =>
    db.mealSlot.findMany({
      where: { archivedAt: null },
      select: { id: true, userId: true, name: true },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText(
      'MealSlot',
      slot.id,
      'name',
      slot.name,
      { max: SECTION_NAME_MAX, required: true },
      report,
    );
    slotsByUser.add(slot.userId);
  }
  slotsByUser.report(report, 'User', 'mealSlots', SECTIONS_PER_USER_MAX);

  for await (const entry of rowsOf((page) =>
    db.diaryEntry.findMany({
      select: {
        id: true,
        name: true,
        foodId: true,
        quantity: true,
        kcal: true,
        carbs: true,
        protein: true,
        fat: true,
      },
      orderBy: { id: 'asc' },
      ...page,
    }),
  )) {
    checkText(
      'DiaryEntry',
      entry.id,
      'name',
      entry.name,
      { max: FOOD_NAME_MAX, required: true },
      report,
    );
    checkRange('DiaryEntry', entry.id, 'quantity', entry.quantity, AMOUNT_MIN, AMOUNT_MAX, report);
    // A logged Lebensmittel is a snapshot of whatever its nutrients were; only a Schnelleintrag is typed in.
    if (entry.foodId === null) {
      checkRange('DiaryEntry', entry.id, 'kcal', entry.kcal, 0, QUICK_ENTRY_KCAL_MAX, report);
      for (const macro of ['carbs', 'protein', 'fat'] as const) {
        checkRange('DiaryEntry', entry.id, macro, entry[macro], 0, QUICK_ENTRY_MACRO_MAX, report);
      }
    }
  }
}

export async function checkInputRules(db: PrismaClient): Promise<InputRuleViolation[]> {
  const violations: InputRuleViolation[] = [];
  const report: Report = (violation) => void violations.push(violation);

  await checkUsers(db, report);
  await checkHomeGyms(db, report);
  await checkCycles(db, report);
  await checkWorkoutDays(db, report);
  await checkWorkouts(db, report);
  await checkSets(db, report);
  await checkExercises(db, report);
  await checkFoods(db, report);
  await checkMeals(db, report);
  await checkDiary(db, report);

  return violations;
}

/**
 * The script's report. `blocking` is true when a row needs a decision by hand: the migration
 * cannot fix it, so deploying anyway would leave that row impossible to save (or, for an e-mail
 * or template-name collision, make the migration abort).
 */
export function formatReport(violations: InputRuleViolation[]): {
  text: string;
  blocking: boolean;
} {
  if (violations.length === 0) {
    return {
      text: '✓ No row breaks an input rule -- the rules and the migration can go live.',
      blocking: false,
    };
  }

  const manual = violations.filter((v) => !v.fixedByMigration);
  const lines = [
    `${manual.length} row issue(s) to fix by hand, ${violations.length - manual.length} corrected by the migration.`,
    '',
  ];

  for (const fixedByMigration of [false, true]) {
    const group = violations.filter((v) => v.fixedByMigration === fixedByMigration);
    if (group.length === 0) continue;
    lines.push(
      fixedByMigration
        ? '== Corrected by the migration (listed for the record) =='
        : '== Fix by hand before migrating and deploying ==',
    );
    const categories = [...new Set(group.map((v) => v.category))].sort();
    for (const category of categories) {
      const rows = group.filter((v) => v.category === category);
      lines.push('', `${category} (${rows.length})`);
      for (const v of rows) lines.push(`  ${v.table} ${v.id} .${v.field} -- ${v.message}`);
    }
    lines.push('');
  }

  return { text: lines.join('\n'), blocking: manual.length > 0 };
}
