import { resolveExerciseName } from './exercise-name.util';

const catalogue = (translations: { locale: 'DE' | 'EN'; name: string }[]) => ({
  id: 'ex-1',
  name: 'Kabel Crunch',
  isCustom: false,
  translations,
});

describe('resolveExerciseName', () => {
  let warn: jest.Mock;
  beforeEach(() => {
    warn = jest.fn();
  });

  it('returns the translation for the requested locale without logging', () => {
    const ex = catalogue([
      { locale: 'DE', name: 'Kabel Crunch' },
      { locale: 'EN', name: 'Cable Crunch' },
    ]);
    expect(resolveExerciseName(ex, 'en', warn)).toBe('Cable Crunch');
    expect(warn).not.toHaveBeenCalled();
  });

  it('never translates a custom exercise, even if rows exist', () => {
    const ex = {
      id: 'c-1',
      name: 'Mein Curl',
      isCustom: true,
      translations: [{ locale: 'EN' as const, name: 'Stray' }],
    };
    expect(resolveExerciseName(ex, 'en', warn)).toBe('Mein Curl');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the default locale and logs entity and locale', () => {
    const ex = catalogue([{ locale: 'DE', name: 'Kabel Crunch' }]);
    expect(resolveExerciseName(ex, 'en', warn)).toBe('Kabel Crunch');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ex-1');
    expect(warn.mock.calls[0][0]).toContain('en');
  });

  it('falls back to any available row when the default locale is missing too', () => {
    const ex = catalogue([{ locale: 'EN', name: 'Cable Crunch' }]);
    expect(resolveExerciseName(ex, 'de', warn)).toBe('Cable Crunch');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the base name, never empty, when there are no rows', () => {
    expect(resolveExerciseName(catalogue([]), 'en', warn)).toBe('Kabel Crunch');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
