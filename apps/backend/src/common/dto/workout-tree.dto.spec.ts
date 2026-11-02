import 'reflect-metadata';
import { CreateWorkoutDto } from '../../workouts/dto/create-workout.dto';
import { UpdateWorkoutDto } from '../../workouts/dto/update-workout.dto';
import { CreateWorkoutTemplateDto } from '../../workout-templates/dto/create-workout-template.dto';
import { UpdateBlueprintDto } from '../../workout-cycles/dto/update-blueprint.dto';
import { constraintsOf, throughPipe } from '../testing/through-pipe';

const set = (order: number, extra: Record<string, unknown> = {}) => ({
  order,
  setType: 'WORKING',
  reps: 8,
  weight: 100,
  rir: 2,
  ...extra,
});

const exercise = (order: number, sets: unknown[] = [set(1)]) => ({
  exerciseId: 'seed-bayesian-curl',
  order,
  sets,
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function workout(overrides: Record<string, unknown> = {}) {
  return {
    date: daysAgo(0),
    localDate: '2026-08-15',
    exercises: [exercise(1)],
    ...overrides,
  };
}

const workoutWithSet = (extra: Record<string, unknown>) =>
  workout({ exercises: [exercise(1, [set(1, extra)])] });

async function propertiesFailing(body: unknown, dto: new () => unknown = CreateWorkoutDto) {
  return (await throughPipe(dto as never, body)).errors.map((e) => e.property);
}

describe('set values', () => {
  it.each([
    ['weight', 0, 1000, 1000.001, -0.001],
    ['weightLeft', 0, 1000, 1001, -1],
    ['weightRight', 0, 1000, 1001, -1],
  ])('%s accepts %s to %s and rejects %s and %s', async (field, min, max, over, under) => {
    for (const ok of [min, max, 102.05828325]) {
      expect(await propertiesFailing(workoutWithSet({ [field]: ok }))).toEqual([]);
    }
    for (const bad of [over, under]) {
      expect(await propertiesFailing(workoutWithSet({ [field]: bad }))).toEqual([
        `exercises.0.sets.0.${field}`,
      ]);
    }
  });

  it('puts no decimal cap on weight (ADR-0005: pounds convert to many decimals)', async () => {
    expect(await propertiesFailing(workoutWithSet({ weight: 102.05828325 }))).toEqual([]);
  });

  it.each(['reps', 'repsLeft', 'repsRight'])(
    '%s is a whole number from 1 to 100',
    async (field) => {
      expect(await propertiesFailing(workoutWithSet({ [field]: 1 }))).toEqual([]);
      expect(await propertiesFailing(workoutWithSet({ [field]: 100 }))).toEqual([]);
      for (const bad of [0, 101, 8.5]) {
        expect(await propertiesFailing(workoutWithSet({ [field]: bad }))).toEqual([
          `exercises.0.sets.0.${field}`,
        ]);
      }
    },
  );

  it.each(['rir', 'rirLeft', 'rirRight'])('%s is a whole number from 0 to 10', async (field) => {
    expect(await propertiesFailing(workoutWithSet({ [field]: 0 }))).toEqual([]);
    expect(await propertiesFailing(workoutWithSet({ [field]: 10 }))).toEqual([]);
    for (const bad of [-1, 11, 1.5]) {
      expect(await propertiesFailing(workoutWithSet({ [field]: bad }))).toEqual([
        `exercises.0.sets.0.${field}`,
      ]);
    }
  });

  it('accepts a very long Rest and never reports it as a user error below the column maximum', async () => {
    for (const rest of [0, 90, 86_400, 100_000_000, 2_147_483_647]) {
      expect(await propertiesFailing(workoutWithSet({ rest }))).toEqual([]);
    }
  });

  it('still refuses a Rest the column could not hold, or a negative one', async () => {
    expect(await propertiesFailing(workoutWithSet({ rest: 2_147_483_648 }))).toEqual([
      'exercises.0.sets.0.rest',
    ]);
    expect(await propertiesFailing(workoutWithSet({ rest: -1 }))).toEqual([
      'exercises.0.sets.0.rest',
    ]);
  });
});

describe('totalDuration', () => {
  it('accepts any non-negative whole number up to the column maximum', async () => {
    for (const totalDuration of [0, 3_600, 1_000_000, 2_147_483_647]) {
      expect(await propertiesFailing(workout({ totalDuration }))).toEqual([]);
      expect(await propertiesFailing(workout({ totalDuration }), UpdateWorkoutDto)).toEqual([]);
    }
  });

  it('rejects a negative, fractional or oversized value', async () => {
    for (const totalDuration of [-1, 1.5, 2_147_483_648]) {
      expect(await propertiesFailing(workout({ totalDuration }))).toEqual(['totalDuration']);
    }
  });
});

describe('array sizes', () => {
  it('allows 20 sets per Uebung and refuses 21', async () => {
    const sets = (n: number) => Array.from({ length: n }, (_, i) => set(i + 1));
    expect(await propertiesFailing(workout({ exercises: [exercise(1, sets(20))] }))).toEqual([]);
    const failing = await throughPipe(
      CreateWorkoutDto,
      workout({ exercises: [exercise(1, sets(21))] }),
    );
    expect(constraintsOf(failing.errors, 'exercises.0.sets')).toEqual(['arrayMaxSize']);
  });

  it.each([
    ['CreateWorkoutDto', CreateWorkoutDto, (exercises: unknown[]) => workout({ exercises })],
    [
      'CreateWorkoutTemplateDto',
      CreateWorkoutTemplateDto,
      (exercises: unknown[]) => ({ name: 'Push', exercises }),
    ],
    ['UpdateBlueprintDto', UpdateBlueprintDto, (exercises: unknown[]) => ({ exercises })],
  ])('allows 30 Uebungen per workout in %s and refuses 31', async (_name, dto, build) => {
    const exercises = (n: number) => Array.from({ length: n }, (_, i) => exercise(i + 1));
    expect((await throughPipe(dto as never, build(exercises(30)))).errors).toEqual([]);
    const failing = await throughPipe(dto as never, build(exercises(31)));
    expect(constraintsOf(failing.errors, 'exercises')).toEqual(['arrayMaxSize']);
  });
});

describe('date of a workout', () => {
  it('accepts 2000-01-01 and today, and refuses the day before 2000 and a date well in the future', async () => {
    expect(await propertiesFailing(workout({ date: '2000-01-01T00:00:00.000Z' }))).toEqual([]);
    expect(await propertiesFailing(workout({ date: daysAgo(0) }))).toEqual([]);

    const tooEarly = await throughPipe(
      CreateWorkoutDto,
      workout({ date: '1999-12-31T23:59:59.999Z' }),
    );
    expect(constraintsOf(tooEarly.errors, 'date')).toEqual(['minDate']);

    const future = await throughPipe(CreateWorkoutDto, workout({ date: daysAgo(-2) }));
    expect(constraintsOf(future.errors, 'date')).toEqual(['maxDate']);
  });

  it('tolerates a day of clock and time-zone slack', async () => {
    expect(await propertiesFailing(workout({ date: daysAgo(-0.9) }))).toEqual([]);
  });

  it('applies the same range when editing a past workout', async () => {
    expect(await propertiesFailing({ date: '1999-01-01T00:00:00.000Z' }, UpdateWorkoutDto)).toEqual(
      ['date'],
    );
  });
});

describe('"save as Vorlage" name', () => {
  const named = (saveAsTemplateName: string) =>
    workout({ saveAsTemplateMode: 'new', saveAsTemplateName });

  it('is 1-100 characters, like a Vorlage name', async () => {
    expect(await propertiesFailing(named('a'.repeat(100)))).toEqual([]);
    expect(
      constraintsOf(
        (await throughPipe(CreateWorkoutDto, named('a'.repeat(101)))).errors,
        'saveAsTemplateName',
      ),
    ).toEqual(['maxLength']);
    expect(
      constraintsOf(
        (await throughPipe(CreateWorkoutDto, named('   '))).errors,
        'saveAsTemplateName',
      ),
    ).toContain('isNotEmpty');
  });

  it('is stored trimmed', async () => {
    const result = await throughPipe(CreateWorkoutDto, named('  Push Day  '));
    expect(result.ok?.saveAsTemplateName).toBe('Push Day');
  });
});
