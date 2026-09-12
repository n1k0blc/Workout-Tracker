import { ValidationPipe } from '@nestjs/common';
import { AnalyticsFilterDto } from './analytics-filter.dto';

// Runs the same validation Nest applies to `@Query() filter: AnalyticsFilterDto` on the
// analytics endpoints.
async function runPipe(query: Record<string, unknown>) {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  return pipe.transform(query, {
    type: 'query',
    metatype: AnalyticsFilterDto,
    data: '',
  });
}

describe('AnalyticsFilterDto', () => {
  describe('exerciseId', () => {
    // Regression: selecting a specific exercise in the analytics view forwards
    // `selectedExercise.id` verbatim as `?exerciseId=`. Global/seeded exercises carry
    // non-UUID ids (e.g. "seed-bayesian-curl"), so `@IsUUID()` here rejected the request
    // with 400 "exerciseId must be a UUID" and the view never updated. The write path
    // (`WorkoutExerciseInputDto.exerciseId`) already treats the id as a plain string.
    it('accepts a seeded (non-UUID) exercise id', async () => {
      await expect(
        runPipe({ exerciseId: 'seed-bayesian-curl' }),
      ).resolves.toMatchObject({ exerciseId: 'seed-bayesian-curl' });
    });

    it('accepts a real UUID exercise id', async () => {
      await expect(
        runPipe({ exerciseId: '11111111-1111-4111-8111-111111111111' }),
      ).resolves.toMatchObject({
        exerciseId: '11111111-1111-4111-8111-111111111111',
      });
    });
  });

  describe('cycleId', () => {
    // Cycles are always app-created, so their ids stay UUIDs.
    it('rejects a non-UUID cycle id', async () => {
      await expect(runPipe({ cycleId: 'not-a-uuid' })).rejects.toThrow();
    });
  });
});
