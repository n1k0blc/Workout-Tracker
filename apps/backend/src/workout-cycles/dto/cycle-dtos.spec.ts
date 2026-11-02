import 'reflect-metadata';
import { CreateCycleDto } from './create-cycle.dto';
import { UpdateCycleDto } from './update-cycle.dto';
import { UpdateWorkoutDayDto } from './update-workout-day.dto';
import { CreateWorkoutTemplateDto } from '../../workout-templates/dto/create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from '../../workout-templates/dto/update-workout-template.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';

const exercises = [
  {
    exerciseId: 'seed-bayesian-curl',
    order: 1,
    sets: [{ order: 1, setType: 'WORKING', reps: 8, weight: 20, rir: 2 }],
  },
];

const day = (weekday: number, name = 'Push') => ({ weekday, name, exercises });

const cycle = (overrides: Record<string, unknown> = {}) => ({
  name: 'Aufbau',
  duration: 8,
  startDate: '2026-11-02',
  workoutDays: [day(1)],
  ...overrides,
});

describe('Zyklus name', () => {
  it('is 1-100 characters on create and update', async () => {
    for (const dto of [CreateCycleDto, UpdateCycleDto]) {
      const body = (name: string) => (dto === CreateCycleDto ? cycle({ name }) : { name });
      expect((await throughPipe(dto as never, body('a'.repeat(100)))).errors).toEqual([]);
      expect(
        constraintsOf((await throughPipe(dto as never, body('a'.repeat(101)))).errors, 'name'),
      ).toEqual(['maxLength']);
      expect(constraintsOf((await throughPipe(dto as never, body('  '))).errors, 'name')).toContain(
        'isNotEmpty',
      );
    }
  });
});

describe('Zyklus duration', () => {
  it('is 1 to 52 weeks', async () => {
    for (const duration of [1, 52]) {
      expect((await throughPipe(CreateCycleDto, cycle({ duration }))).errors).toEqual([]);
      expect((await throughPipe(UpdateCycleDto, { duration })).errors).toEqual([]);
    }
    for (const duration of [0, 53]) {
      expect(
        constraintsOf((await throughPipe(CreateCycleDto, cycle({ duration }))).errors, 'duration'),
      ).toHaveLength(1);
      expect(
        constraintsOf((await throughPipe(UpdateCycleDto, { duration })).errors, 'duration'),
      ).toHaveLength(1);
    }
  });
});

describe('Trainingstag', () => {
  it('name is 1-50 characters when creating a Zyklus and when editing a day', async () => {
    const create = (name: string) =>
      throughPipe(CreateCycleDto, cycle({ workoutDays: [day(1, name)] }));
    expect((await create('a'.repeat(50))).errors).toEqual([]);
    expect(constraintsOf((await create('a'.repeat(51))).errors, 'workoutDays.0.name')).toEqual([
      'maxLength',
    ]);

    const edit = (name: string) => throughPipe(UpdateWorkoutDayDto, { name, weekday: 1 });
    expect((await edit('a'.repeat(50))).errors).toEqual([]);
    expect(constraintsOf((await edit('a'.repeat(51))).errors, 'name')).toEqual(['maxLength']);
    expect(constraintsOf((await edit('')).errors, 'name')).toContain('isNotEmpty');
  });

  it('allows 7 Trainingstage per Zyklus and refuses 8', async () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => day(i % 7));
    expect((await throughPipe(CreateCycleDto, cycle({ workoutDays: days(7) }))).errors).toEqual([]);
    expect(
      constraintsOf(
        (await throughPipe(CreateCycleDto, cycle({ workoutDays: days(8) }))).errors,
        'workoutDays',
      ),
    ).toEqual(['arrayMaxSize']);
  });
});

describe('Vorlage name', () => {
  it('is 1-100 characters on create and update, trimmed', async () => {
    const create = (name: string) => throughPipe(CreateWorkoutTemplateDto, { name, exercises });
    expect((await create('a'.repeat(100))).errors).toEqual([]);
    expect(constraintsOf((await create('a'.repeat(101))).errors, 'name')).toEqual(['maxLength']);
    expect(constraintsOf((await create('')).errors, 'name')).toContain('isNotEmpty');
    expect((await create('  Push  ')).ok?.name).toBe('Push');

    const update = (name: string) => throughPipe(UpdateWorkoutTemplateDto, { name });
    expect((await update('a'.repeat(100))).errors).toEqual([]);
    expect(constraintsOf((await update('a'.repeat(101))).errors, 'name')).toEqual(['maxLength']);
  });

  it('rejects control characters', async () => {
    expect(
      constraintsOf(
        (await throughPipe(CreateWorkoutTemplateDto, { name: 'Pu\nsh', exercises })).errors,
        'name',
      ),
    ).toEqual(['noControlCharacters']);
  });
});
