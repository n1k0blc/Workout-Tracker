import 'reflect-metadata';
import { LastPerformanceQueryDto, WorkoutsQueryDto } from './workouts-query.dto';
import { AnalyticsFilterDto } from '../../common/dto/analytics-filter.dto';
import { PersonalRecordsQueryDto } from '../../analytics/dto/personal-records-query.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';

const query = <T>(dto: new () => T, q: Record<string, unknown>) => throughPipe(dto, q, 'query', '');

describe('GET /workouts', () => {
  it('accepts no filter, a date range and a cycle', async () => {
    expect((await query(WorkoutsQueryDto, {})).errors).toEqual([]);
    expect(
      (
        await query(WorkoutsQueryDto, {
          startDate: '2026-01-01',
          endDate: '2026-01-31T23:59:59.999Z',
          cycleId: '11111111-1111-4111-8111-111111111111',
        })
      ).errors,
    ).toEqual([]);
  });

  it('answers 400 for a date that is not a date', async () => {
    expect(
      constraintsOf((await query(WorkoutsQueryDto, { startDate: 'tomorrow' })).errors, 'startDate'),
    ).toEqual(['isDateString']);
    expect(
      constraintsOf((await query(WorkoutsQueryDto, { endDate: '31.01.2026' })).errors, 'endDate'),
    ).toEqual(['isDateString']);
  });

  it('accepts a range starting the day it ends and refuses one that ends before it starts', async () => {
    expect(
      (await query(WorkoutsQueryDto, { startDate: '2026-01-31', endDate: '2026-01-31' })).errors,
    ).toEqual([]);
    expect(
      constraintsOf(
        (await query(WorkoutsQueryDto, { startDate: '2026-02-01', endDate: '2026-01-31' })).errors,
        'endDate',
      ),
    ).toEqual(['endBeforeStart']);
  });

  it('refuses a malformed cycle id and unknown parameters', async () => {
    expect(
      constraintsOf((await query(WorkoutsQueryDto, { cycleId: '../x' })).errors, 'cycleId'),
    ).toEqual(['isId']);
    expect((await query(WorkoutsQueryDto, { sort: 'asc' })).errors).toEqual([
      { property: 'sort', constraints: ['whitelistValidation'] },
    ]);
  });
});

describe('GET /workouts/exercise-last-performance', () => {
  it('accepts a seeded exercise id', async () => {
    expect(
      (await query(LastPerformanceQueryDto, { exerciseId: 'seed-bayesian-curl', gymId: 'andere' }))
        .errors,
    ).toEqual([]);
  });

  it.each(['exerciseId', 'gymId', 'excludeWorkoutId'])(
    'answers 400 for a malformed %s',
    async (field) => {
      for (const bad of ['', 'a b', 'x'.repeat(101), "1' OR '1'='1"]) {
        expect(
          constraintsOf((await query(LastPerformanceQueryDto, { [field]: bad })).errors, field),
        ).toEqual(['isId']);
      }
      expect((await query(LastPerformanceQueryDto, { [field]: 'x'.repeat(100) })).errors).toEqual(
        [],
      );
    },
  );
});

describe('GET /analytics/prs', () => {
  it('takes one or several muscle groups and equipment, checked against their enums', async () => {
    expect(
      (
        await query(PersonalRecordsQueryDto, {
          muscleGroup: ['CHEST', 'BICEPS'],
          equipment: 'BARBELL',
        })
      ).errors,
    ).toEqual([]);
    expect(
      constraintsOf(
        (await query(PersonalRecordsQueryDto, { muscleGroup: 'CHEST,BICEPS' })).errors,
        'muscleGroup',
      ),
    ).toEqual(['isEnum']);
    expect(
      constraintsOf(
        (await query(PersonalRecordsQueryDto, { equipment: ['BARBELL', 'SPOON'] })).errors,
        'equipment',
      ),
    ).toEqual(['isEnum']);
  });

  it('checks the gym id and tolerates the exercise id the client sends along', async () => {
    expect(
      (await query(PersonalRecordsQueryDto, { gymId: 'alle', exerciseId: 'seed-bayesian-curl' }))
        .errors,
    ).toEqual([]);
    expect(
      constraintsOf((await query(PersonalRecordsQueryDto, { gymId: 'a/b' })).errors, 'gymId'),
    ).toEqual(['isId']);
  });
});

describe('analytics filter', () => {
  it('checks muscleGroup and equipment against their enums', async () => {
    expect(
      (await query(AnalyticsFilterDto, { muscleGroup: 'CHEST', equipment: ['CABLE', 'MACHINE'] }))
        .errors,
    ).toEqual([]);
    expect(
      constraintsOf(
        (await query(AnalyticsFilterDto, { muscleGroup: 'LEGS' })).errors,
        'muscleGroup',
      ),
    ).toEqual(['isEnum']);
    expect(
      constraintsOf((await query(AnalyticsFilterDto, { equipment: 'SPOON' })).errors, 'equipment'),
    ).toEqual(['isEnum']);
  });

  it('checks ids, still allowing seeded exercise ids and the gym keywords', async () => {
    expect(
      (await query(AnalyticsFilterDto, { exerciseId: 'seed-bayesian-curl', gymId: 'andere' }))
        .errors,
    ).toEqual([]);
    expect(
      constraintsOf((await query(AnalyticsFilterDto, { exerciseId: 'a b' })).errors, 'exerciseId'),
    ).toEqual(['isId']);
    expect(
      constraintsOf((await query(AnalyticsFilterDto, { gymId: 'x'.repeat(101) })).errors, 'gymId'),
    ).toEqual(['isId']);
  });
});
