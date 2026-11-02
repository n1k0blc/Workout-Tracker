import 'reflect-metadata';
import { throughPipe } from '../testing/through-pipe';

/** A path parameter as Nest hands it to the global pipe: `@Param('id') id: string`. */
const param = (value: unknown, name = 'id') => throughPipe(String as never, value, 'param', name);

describe('path parameters', () => {
  it.each([
    '11111111-1111-4111-8111-111111111111',
    'seed-bayesian-curl',
    'cm0abc_DEF-123',
    '4006381333931',
    'x'.repeat(100),
  ])('accepts %s', async (id) => {
    expect(await param(id)).toEqual({ ok: id, errors: [] });
  });

  it.each([
    ['empty', ''],
    ['too long', 'x'.repeat(101)],
    ['a space', 'a b'],
    ['a slash', 'a/b'],
    ['a dot path', '..'],
    ['an injection attempt', "1' OR '1'='1"],
    ['a control character', 'a\nb'],
    ['a percent escape', '%00'],
    ['a non-ASCII letter', 'Übung'],
  ])('answers 400 for an id with %s', async (_what, id) => {
    expect((await param(id)).errors).toEqual([{ property: 'id', constraints: ['isId'] }]);
  });

  it('names the parameter that failed, for routes with more than one', async () => {
    expect((await param('a b', 'workoutDayId')).errors).toEqual([
      { property: 'workoutDayId', constraints: ['isId'] },
    ]);
  });

  it('leaves other argument kinds alone', async () => {
    expect((await throughPipe(String as never, 'a b', 'custom', 'x')).errors).toEqual([]);
  });
});
