import 'reflect-metadata';
import { CreateExerciseDto } from './create-exercise.dto';
import { UpdateExerciseDto } from './update-exercise.dto';
import { FilterExerciseDto } from './filter-exercise.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';

const created = (overrides: Record<string, unknown> = {}) => ({
  name: 'Pull-up (assisted)',
  equipment: 'BODYWEIGHT',
  ...overrides,
});

describe('Uebung name', () => {
  it.each([
    ['CreateExerciseDto', CreateExerciseDto],
    ['UpdateExerciseDto', UpdateExerciseDto],
  ])('is 1-100 characters with special characters allowed in %s', async (_n, dto) => {
    const run = (name: string) => throughPipe(dto as never, created({ name }));
    expect((await run('Pull-up (assisted) & "T-Bar" 7UP')).errors).toEqual([]);
    expect((await run('a'.repeat(100))).errors).toEqual([]);
    expect(constraintsOf((await run('a'.repeat(101))).errors, 'name')).toEqual(['maxLength']);
    expect(constraintsOf((await run('   ')).errors, 'name')).toContain('isNotEmpty');
    expect(constraintsOf((await run('Row​')).errors, 'name')).toEqual(['noControlCharacters']);
    expect((await run('  Row  ')).ok).toMatchObject({ name: 'Row' });
  });
});

describe('CreateExerciseDto', () => {
  it('no longer accepts a description: it had no column behind it', async () => {
    const result = await throughPipe(CreateExerciseDto, created({ description: 'x' }));
    expect(result.errors).toEqual([{ property: 'description', constraints: ['whitelistValidation'] }]);
  });
});

describe('exercise list query', () => {
  const query = (q: Record<string, unknown>) => throughPipe(FilterExerciseDto, q, 'query', '');

  it('takes any characters in a search term, trimmed and capped at 100', async () => {
    for (const search of ["T-Bar Row", '7UP', "M&M's", 'a'.repeat(100)]) {
      expect((await query({ search })).errors).toEqual([]);
    }
    expect((await query({ search: '  Row ' })).ok?.search).toBe('Row');
    expect(constraintsOf((await query({ search: 'a'.repeat(101) })).errors, 'search')).toEqual([
      'maxLength',
    ]);
  });

  it('takes includeCustom as a flag and refuses anything else', async () => {
    for (const includeCustom of ['true', 'false']) {
      expect((await query({ includeCustom })).errors).toEqual([]);
    }
    expect(constraintsOf((await query({ includeCustom: 'yes' })).errors, 'includeCustom')).toEqual([
      'isIn',
    ]);
  });
});
