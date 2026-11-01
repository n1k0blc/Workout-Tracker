import { PrismaClient } from '../../../generated/prisma/client';
import { checkInputRules, formatReport, InputRuleViolation } from './input-rules-check';

/**
 * `checkInputRules` is the logic behind `npm run check:input-rules` (#223). It is read-only:
 * the only Prisma calls it may make are `findMany`. These tests hand it rows through a mocked
 * client and assert on the violations it reports -- never on which query produced them.
 */

const MODELS = [
  'user',
  'homeGym',
  'workoutCycle',
  'workoutDay',
  'workout',
  'workoutExercise',
  'workoutSet',
  'exercise',
  'food',
  'foodPortion',
  'meal',
  'mealItem',
  'mealSlot',
  'diaryEntry',
] as const;

type Rows = Partial<Record<(typeof MODELS)[number], Record<string, unknown>[]>>;

/** Every model answers `findMany` with the rows given for it, or none. */
function makeDb(rows: Rows = {}) {
  const db: Record<string, { findMany: jest.Mock }> = {};
  for (const model of MODELS) {
    db[model] = { findMany: jest.fn().mockResolvedValue(rows[model] ?? []) };
  }
  return db as Record<(typeof MODELS)[number], { findMany: jest.Mock }>;
}

async function run(rows: Rows): Promise<InputRuleViolation[]> {
  return checkInputRules(makeDb(rows) as unknown as PrismaClient);
}

const set = (overrides: Record<string, unknown> = {}) => ({
  id: 'set-1',
  setType: 'WORKING',
  reps: 8,
  weight: 80,
  rir: 2,
  repsLeft: null,
  repsRight: null,
  weightLeft: null,
  weightRight: null,
  rirLeft: null,
  rirRight: null,
  ...overrides,
});

describe('checkInputRules', () => {
  it('reports nothing for clean data', async () => {
    expect(await run({ workoutSet: [set()] })).toEqual([]);
  });

  describe('warm-up sets with RIR', () => {
    it.each(['rir', 'rirLeft', 'rirRight'])(
      'reports a warm-up set carrying %s, fixable by the migration',
      async (field) => {
        const violations = await run({
          workoutSet: [set({ setType: 'WARMUP', rir: null, [field]: 3 })],
        });

        expect(violations).toEqual([
          expect.objectContaining({
            category: 'warm-up-rir',
            table: 'WorkoutSet',
            id: 'set-1',
            field,
            fixedByMigration: true,
          }),
        ]);
      },
    );

    it('leaves a warm-up set without RIR alone, and a working set with RIR', async () => {
      const violations = await run({
        workoutSet: [
          set({ id: 'a', setType: 'WARMUP', rir: null }),
          set({ id: 'b', rir: 3, rirLeft: 3, rirRight: 3 }),
        ],
      });

      expect(violations).toEqual([]);
    });
  });
  describe('users', () => {
    const user = (overrides: Record<string, unknown> = {}) => ({
      id: 'user-1',
      email: 'niko@example.com',
      firstName: 'Niko',
      lastName: 'Bjelic',
      dateOfBirth: new Date('1990-05-01T00:00:00.000Z'),
      height: 180,
      weight: 82.5,
      targetKcal: 2500,
      targetCarbs: 250,
      targetProtein: 150,
      targetFat: 80,
      ...overrides,
    });

    it('reports e-mails that differ only by case, once per account, as needing a manual decision', async () => {
      const violations = await run({
        user: [
          user({ id: 'a', email: 'Niko@x.com' }),
          user({ id: 'b', email: 'niko@x.com' }),
          user({ id: 'c', email: 'other@x.com' }),
        ],
      });

      const duplicates = violations.filter((v) => v.category === 'email-case-duplicate');
      expect(duplicates.map((v) => v.id).sort()).toEqual(['a', 'b']);
      expect(duplicates.every((v) => !v.fixedByMigration)).toBe(true);
      expect(duplicates[0].message).toContain('niko@x.com');
    });

    it('counts surrounding whitespace as the same address', async () => {
      const violations = await run({
        user: [user({ id: 'a', email: 'niko@x.com ' }), user({ id: 'b', email: 'NIKO@x.com' })],
      });

      expect(violations.filter((v) => v.category === 'email-case-duplicate')).toHaveLength(2);
    });

    it('reports a mixed-case e-mail as fixable by lowercasing', async () => {
      expect(await run({ user: [user({ email: 'Niko@Example.com' })] })).toEqual([
        expect.objectContaining({
          category: 'email-not-lowercase',
          table: 'User',
          field: 'email',
          fixedByMigration: true,
        }),
      ]);
    });

    it('allows an e-mail of 254 characters and reports 255', async () => {
      const email = (n: number) => `${'a'.repeat(n - '@example.com'.length)}@example.com`;

      expect(await run({ user: [user({ email: email(254) })] })).toEqual([]);
      expect(await run({ user: [user({ email: email(255) })] })).toEqual([
        expect.objectContaining({
          category: 'text-too-long',
          field: 'email',
          fixedByMigration: false,
        }),
      ]);
    });

    it('reports a padded name as fixable, and judges the rest on the trimmed value', async () => {
      expect(await run({ user: [user({ firstName: ' Niko ' })] })).toEqual([
        expect.objectContaining({
          category: 'text-not-trimmed',
          field: 'firstName',
          fixedByMigration: true,
        }),
      ]);
    });

    it.each([
      ['Max2', 'invalid-person-name'],
      ['-Anna', 'invalid-person-name'],
      ['a'.repeat(51), 'text-too-long'],
      ['   ', 'text-empty'],
    ])(
      'reports the first name %j as %s, not fixable by the migration',
      async (firstName, category) => {
        const violations = await run({ user: [user({ firstName })] });

        expect(violations).toContainEqual(
          expect.objectContaining({ category, field: 'firstName', fixedByMigration: false }),
        );
      },
    );

    it('accepts real names and leaves a missing name alone', async () => {
      const violations = await run({
        user: [
          user({ firstName: 'Nguyễn', lastName: "O'Brien" }),
          user({ id: 'u2', email: 'b@x.com', firstName: null, lastName: null }),
        ],
      });

      expect(violations).toEqual([]);
    });

    it('reports control characters in a name', async () => {
      const violations = await run({ user: [user({ lastName: 'Bje\u200Blic' })] });

      expect(violations).toContainEqual(
        expect.objectContaining({ category: 'control-characters', field: 'lastName' }),
      );
    });

    it.each([
      ['height', 99, true],
      ['height', 100, false],
      ['height', 250, false],
      ['height', 251, true],
      ['weight', 29.9, true],
      ['weight', 30, false],
      ['weight', 400, false],
      ['weight', 400.1, true],
      ['targetKcal', 499, true],
      ['targetKcal', 500, false],
      ['targetKcal', 10000, false],
      ['targetKcal', 10001, true],
      ['targetFat', 0, true],
      ['targetFat', 1, false],
      ['targetFat', 1000, false],
      ['targetFat', 1001, true],
    ])('%s of %s is reported: %s', async (field, value, reported) => {
      const violations = await run({ user: [user({ [field]: value })] });

      expect(
        violations.filter((v) => v.category === 'out-of-range' && v.field === field),
      ).toHaveLength(reported ? 1 : 0);
    });

    it('checks the birth date for an age of 13 to 120 and not in the future', async () => {
      const yearsAgo = (years: number, extraDays = 0) => {
        const d = new Date();
        d.setUTCFullYear(d.getUTCFullYear() - years);
        d.setUTCDate(d.getUTCDate() + extraDays);
        return d;
      };
      const dob = async (dateOfBirth: Date) =>
        (await run({ user: [user({ dateOfBirth })] })).filter(
          (v) => v.category === 'invalid-birth-date',
        );

      expect(await dob(yearsAgo(13, -1))).toHaveLength(0);
      expect(await dob(yearsAgo(13, 1))).toHaveLength(1); // 12 years and 364 days
      expect(await dob(yearsAgo(120, 1))).toHaveLength(0);
      expect(await dob(yearsAgo(121, -1))).toHaveLength(1);
      expect(await dob(yearsAgo(-1))).toHaveLength(1); // next year
    });
  });
  describe('names and counts across the app', () => {
    const only = (violations: InputRuleViolation[], category: string) =>
      violations.filter((v) => v.category === category);

    it.each([
      ['homeGym', 'HomeGym', 'name', 100],
      ['workoutDay', 'WorkoutDay', 'name', 50],
      ['workoutCycle', 'WorkoutCycle', 'name', 100],
      ['exercise', 'Exercise', 'name', 100],
      ['meal', 'Meal', 'name', 120],
      ['mealSlot', 'MealSlot', 'name', 60],
      ['foodPortion', 'FoodPortion', 'label', 60],
      ['diaryEntry', 'DiaryEntry', 'name', 120],
    ] as const)(
      '%s: a %s %s is fine at %i characters and reported one over',
      async (model, table, field, max) => {
        const row = (value: string) => ({
          id: 'row-1',
          duration: 8,
          quantity: 1,
          kcal: 0,
          carbs: 0,
          protein: 0,
          fat: 0,
          foodId: 'food-1',
          grams: 100,
          [field]: value,
        });

        expect(await run({ [model]: [row('a'.repeat(max))] })).toEqual([]);
        expect(await run({ [model]: [row('a'.repeat(max + 1))] })).toEqual([
          expect.objectContaining({
            category: 'text-too-long',
            table,
            id: 'row-1',
            field,
            fixedByMigration: false,
          }),
        ]);
      },
    );

    it('allows special characters in names', async () => {
      expect(await run({ homeGym: [{ id: 'g', name: 'Fit & Fun <24/7>' }] })).toEqual([]);
    });

    it('reports a padded template name as fixable, and a pair that collide once trimmed as manual', async () => {
      const violations = await run({
        workout: [
          { id: 'a', kind: 'TEMPLATE', userId: 'u1', name: 'Push ', date: null },
          { id: 'b', kind: 'TEMPLATE', userId: 'u1', name: 'Push', date: null },
          { id: 'c', kind: 'TEMPLATE', userId: 'u2', name: 'Push ', date: null },
        ],
      });

      expect(
        only(violations, 'text-not-trimmed')
          .map((v) => v.id)
          .sort(),
      ).toEqual(['a', 'c']);
      expect(
        only(violations, 'template-name-collision')
          .map((v) => v.id)
          .sort(),
      ).toEqual(['a', 'b']);
      expect(only(violations, 'template-name-collision').every((v) => !v.fixedByMigration)).toBe(
        true,
      );
    });

    it('reports a user holding 11 gyms, but not 10', async () => {
      const gyms = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: 'Gym', userId: 'u1' }));

      expect(only(await run({ homeGym: gyms(10) }), 'too-many-rows')).toHaveLength(0);
      expect(only(await run({ homeGym: gyms(11) }), 'too-many-rows')).toEqual([
        expect.objectContaining({ table: 'User', id: 'u1', field: 'homeGyms' }),
      ]);
    });

    it('reports a user holding 11 Abschnitte, but not 10', async () => {
      const slots = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: 'Slot', userId: 'u1' }));

      expect(only(await run({ mealSlot: slots(10) }), 'too-many-rows')).toHaveLength(0);
      expect(only(await run({ mealSlot: slots(11) }), 'too-many-rows')).toHaveLength(1);
    });
  });

  describe('Zyklen', () => {
    const cycle = (overrides: Record<string, unknown> = {}) => ({
      id: 'c1',
      userId: 'u1',
      name: 'Push/Pull',
      duration: 8,
      status: 'COMPLETED',
      ...overrides,
    });

    it('reports every active cycle of a user holding more than one', async () => {
      const violations = await run({
        workoutCycle: [
          cycle({ id: 'a', status: 'ACTIVE' }),
          cycle({ id: 'b', status: 'ACTIVE' }),
          cycle({ id: 'c' }),
          cycle({ id: 'd', userId: 'u2', status: 'ACTIVE' }),
        ],
      });

      expect(violations.map((v) => [v.category, v.id])).toEqual([
        ['multiple-active-cycles', 'a'],
        ['multiple-active-cycles', 'b'],
      ]);
      expect(violations[0].fixedByMigration).toBe(false);
    });

    it.each([
      [0, true],
      [1, false],
      [52, false],
      [53, true],
    ])('duration %i is reported: %s', async (duration, reported) => {
      const violations = await run({ workoutCycle: [cycle({ duration })] });

      expect(violations.filter((v) => v.field === 'duration')).toHaveLength(reported ? 1 : 0);
    });
  });

  describe('workouts', () => {
    const performed = (date: Date | null) => ({
      id: 'w1',
      kind: 'WORKOUT',
      userId: 'u1',
      name: null,
      date,
    });

    it('reports a performed workout dated before 2000 or in the future', async () => {
      expect(await run({ workout: [performed(new Date('2000-01-01T00:00:00.000Z'))] })).toEqual([]);
      expect(await run({ workout: [performed(new Date('1999-12-31T12:00:00.000Z'))] })).toEqual([
        expect.objectContaining({
          category: 'invalid-workout-date',
          table: 'Workout',
          id: 'w1',
          field: 'date',
        }),
      ]);
      expect(
        await run({ workout: [performed(new Date(Date.now() + 2 * 86_400_000))] }),
      ).toHaveLength(1);
    });

    it('does not judge the name of a performed workout or the date of a template', async () => {
      expect(
        await run({
          workout: [
            {
              id: 'w',
              kind: 'WORKOUT',
              userId: 'u1',
              name: 'x'.repeat(500),
              date: new Date('2026-01-01'),
            },
          ],
        }),
      ).toEqual([]);
    });

    it('reports 31 exercises in a workout, but not 30', async () => {
      const exercises = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ id: `e${i}`, workoutId: 'w1' }));

      expect(await run({ workoutExercise: exercises(30) })).toEqual([]);
      expect(await run({ workoutExercise: exercises(31) })).toEqual([
        expect.objectContaining({
          category: 'too-many-rows',
          table: 'Workout',
          id: 'w1',
          field: 'exercises',
        }),
      ]);
    });

    it('reports 21 sets in an exercise, but not 20', async () => {
      const sets = (n: number) =>
        Array.from({ length: n }, (_, i) => set({ id: `s${i}`, workoutExerciseId: 'we1' }));

      expect(await run({ workoutSet: sets(20) })).toEqual([]);
      expect(await run({ workoutSet: sets(21) })).toEqual([
        expect.objectContaining({
          category: 'too-many-rows',
          table: 'WorkoutExercise',
          id: 'we1',
          field: 'sets',
        }),
      ]);
    });
  });

  describe('set values', () => {
    const outOfRange = async (overrides: Record<string, unknown>) =>
      (await run({ workoutSet: [set(overrides)] })).filter((v) => v.category === 'out-of-range');

    it.each([
      ['weight', -1, true],
      ['weight', 0, false],
      ['weight', 1000, false],
      ['weight', 1000.5, true],
      ['weightLeft', 1001, true],
      ['weightRight', 1001, true],
      ['reps', 0, true],
      ['reps', 1, false],
      ['reps', 100, false],
      ['reps', 101, true],
      ['repsLeft', 101, true],
      ['repsRight', 0, true],
      ['rir', -1, true],
      ['rir', 0, false],
      ['rir', 10, false],
      ['rir', 11, true],
      ['rirLeft', 11, true],
      ['rirRight', 11, true],
    ])('%s of %s is reported: %s', async (field, value, reported) => {
      expect(await outOfRange({ [field]: value })).toHaveLength(reported ? 1 : 0);
    });
  });

  describe('Lebensmittel', () => {
    const food = (overrides: Record<string, unknown> = {}) => ({
      id: 'f1',
      name: 'Haferflocken',
      brand: null,
      barcode: null,
      kcal: 370,
      carbs: 60,
      protein: 13,
      fat: 7,
      ...overrides,
    });
    const found = async (overrides: Record<string, unknown>, category: string) =>
      (await run({ food: [food(overrides)] })).filter((v) => v.category === category);

    it.each([
      ['kcal', 900, false],
      ['kcal', 901, true],
      ['kcal', -1, true],
      ['carbs', 100, false],
      ['carbs', 100.1, true],
    ])('%s of %s is reported: %s', async (field, value, reported) => {
      const violations = await found(
        { carbs: 0, protein: 0, fat: 0, [field]: value },
        'out-of-range',
      );

      expect(violations.filter((v) => v.field === field)).toHaveLength(reported ? 1 : 0);
    });

    it('reports carbs, protein and fat above 100 g together, but not exactly 100', async () => {
      expect(await found({ carbs: 50, protein: 30, fat: 20 }, 'macro-sum')).toHaveLength(0);
      expect(await found({ carbs: 50, protein: 30, fat: 20.1 }, 'macro-sum')).toHaveLength(1);
    });

    it('limits name and brand to 120 characters', async () => {
      expect(await found({ brand: 'b'.repeat(121) }, 'text-too-long')).toEqual([
        expect.objectContaining({ field: 'brand' }),
      ]);
      expect(await found({ name: 'n'.repeat(121) }, 'text-too-long')).toEqual([
        expect.objectContaining({ field: 'name' }),
      ]);
    });

    it.each([
      ['4006381333931', false], // EAN-13
      ['036000291452', false], // UPC-A, 12 digits
      ['96385074', false], // EAN-8
      ['4006381333932', true], // wrong check digit
      ['40063813339', true], // 11 digits
      ['4006381333a31', true],
    ])('barcode %s is reported: %s', async (barcode, reported) => {
      expect(await found({ barcode }, 'invalid-barcode')).toHaveLength(reported ? 1 : 0);
    });

    it('reports 11 portions of one food, but not 10', async () => {
      const portions = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          id: `p${i}`,
          foodId: 'f1',
          label: 'Portion',
          grams: 40,
        }));

      expect(await run({ foodPortion: portions(10) })).toEqual([]);
      expect(await run({ foodPortion: portions(11) })).toEqual([
        expect.objectContaining({
          category: 'too-many-rows',
          table: 'Food',
          id: 'f1',
          field: 'portions',
        }),
      ]);
    });

    it.each([
      [0.09, true],
      [0.1, false],
      [5000, false],
      [5000.1, true],
    ])('a portion of %s g is reported: %s', async (grams, reported) => {
      const violations = await run({
        foodPortion: [{ id: 'p', foodId: 'f1', label: 'Portion', grams }],
      });

      expect(violations).toHaveLength(reported ? 1 : 0);
    });
  });

  describe('Ernaehrung', () => {
    const entry = (overrides: Record<string, unknown> = {}) => ({
      id: 'd1',
      name: 'Quick',
      foodId: null,
      quantity: 1,
      kcal: 300,
      carbs: 30,
      protein: 20,
      fat: 10,
      ...overrides,
    });
    const bad = async (overrides: Record<string, unknown>) =>
      (await run({ diaryEntry: [entry(overrides)] })).filter((v) => v.category === 'out-of-range');

    it.each([
      ['kcal', 10000, false],
      ['kcal', 10001, true],
      ['carbs', 1000, false],
      ['carbs', 1001, true],
      ['protein', 1001, true],
      ['fat', 1001, true],
      ['quantity', 0.09, true],
      ['quantity', 0.1, false],
      ['quantity', 5000, false],
      ['quantity', 5000.1, true],
    ])('Schnelleintrag %s of %s is reported: %s', async (field, value, reported) => {
      expect(await bad({ [field]: value })).toHaveLength(reported ? 1 : 0);
    });

    it('leaves the nutrient snapshot of a Lebensmittel entry alone', async () => {
      expect(await bad({ foodId: 'food-1', kcal: 20000 })).toHaveLength(0);
    });

    it('limits a Mahlzeit item quantity to 0.1-5000', async () => {
      expect(await run({ mealItem: [{ id: 'm', quantity: 5000 }] })).toEqual([]);
      expect(await run({ mealItem: [{ id: 'm', quantity: 5001 }] })).toHaveLength(1);
    });
  });

  it('reads every table in batches, so a large database is never loaded at once', async () => {
    const full = Array.from({ length: 1000 }, (_, i) =>
      set({ id: `s${String(i).padStart(4, '0')}`, workoutExerciseId: `we${i}` }),
    );
    const db = makeDb();
    db.workoutSet.findMany
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce([set({ id: 'zz', setType: 'WARMUP', workoutExerciseId: 'weZ' })]);

    const violations = await checkInputRules(db as unknown as PrismaClient);

    expect(violations).toEqual([expect.objectContaining({ id: 'zz', category: 'warm-up-rir' })]);
    expect(db.workoutSet.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: 's0999' }, skip: 1 }),
    );
  });

  it('never writes', async () => {
    const db = makeDb({ user: [{ id: 'u', email: 'A@x.com', firstName: null, lastName: null }] });

    await checkInputRules(db as unknown as PrismaClient);

    for (const model of MODELS) {
      expect(Object.keys(db[model])).toEqual(['findMany']);
    }
  });
});

describe('formatReport', () => {
  const violation = (overrides: Partial<InputRuleViolation>): InputRuleViolation => ({
    category: 'text-too-long',
    table: 'Food',
    id: 'f1',
    field: 'name',
    message: 'is 130 characters; the limit is 120',
    fixedByMigration: false,
    ...overrides,
  });

  it('is clean and not blocking without violations', () => {
    expect(formatReport([])).toEqual({
      text: expect.stringContaining('No row breaks'),
      blocking: false,
    });
  });

  it('lists every row with its table, id, field and reason, grouped by category', () => {
    const { text } = formatReport([violation({}), violation({ id: 'f2', field: 'brand' })]);

    expect(text).toContain('text-too-long');
    expect(text).toContain('Food f1 .name');
    expect(text).toContain('Food f2 .brand');
    expect(text).toContain('is 130 characters; the limit is 120');
  });

  it('blocks the deploy for rows the migration cannot fix', () => {
    const { text, blocking } = formatReport([violation({})]);

    expect(blocking).toBe(true);
    expect(text).toContain('fix by hand');
  });

  it('does not block for rows the migration corrects', () => {
    const { text, blocking } = formatReport([
      violation({ category: 'warm-up-rir', fixedByMigration: true }),
    ]);

    expect(blocking).toBe(false);
    expect(text).toContain('corrected by the migration');
  });
});
