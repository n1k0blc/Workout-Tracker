import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateWorkoutDto } from './create-workout.dto';
import { UpdateWorkoutDto } from './update-workout.dto';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-08-15T18:30:00.000Z',
    localDate: '2026-08-15',
    exercises: [
      {
        exerciseId: 'exercise-1',
        order: 1,
        sets: [{ order: 1, setType: 'WORKING', reps: 8, weight: 100 }],
      },
    ],
    ...overrides,
  };
}

function errorsFor(dto: object, payload: Record<string, unknown>) {
  return validateSync(plainToInstance(dto as never, payload) as object);
}

function failedProperties(payload: Record<string, unknown>, dto: object = CreateWorkoutDto) {
  return errorsFor(dto, payload).map((e) => e.property);
}

describe('CreateWorkoutDto localDate', () => {
  it('accepts a workout carrying a plain calendar date', () => {
    expect(failedProperties(basePayload())).toEqual([]);
  });

  it('rejects a workout submitted without a localDate', () => {
    const { localDate: _omitted, ...withoutLocalDate } = basePayload();
    expect(failedProperties(withoutLocalDate)).toContain('localDate');
  });

  it('rejects a localDate that is an instant rather than a calendar day', () => {
    expect(failedProperties(basePayload({ localDate: '2026-08-15T18:30:00.000Z' }))).toContain(
      'localDate',
    );
  });

  it('rejects a localDate that is not a real calendar day', () => {
    expect(failedProperties(basePayload({ localDate: '2026-02-30' }))).toContain('localDate');
  });
});

describe('UpdateWorkoutDto localDate', () => {
  it('accepts an update that leaves the stored localDate alone', () => {
    const { localDate: _omitted, date: _date, ...rest } = basePayload();
    expect(failedProperties(rest, UpdateWorkoutDto)).toEqual([]);
  });

  it('rejects an update that sets an invalid localDate', () => {
    expect(failedProperties(basePayload({ localDate: '15.08.2026' }), UpdateWorkoutDto)).toContain(
      'localDate',
    );
  });
});
