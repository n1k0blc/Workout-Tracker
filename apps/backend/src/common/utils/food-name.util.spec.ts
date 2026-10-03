import { resolveFoodName, resolvePortionLabel } from './food-name.util';

const food = (
  over: Partial<{
    source: 'SEED' | 'OPEN_FOOD_FACTS' | 'USER';
    translations: { locale: 'DE' | 'EN'; name: string }[];
  }> = {},
) => ({
  id: 'f-1',
  name: 'Banane',
  source: 'SEED' as const,
  translations: [] as { locale: 'DE' | 'EN'; name: string }[],
  ...over,
});

const portion = (translations: { locale: 'DE' | 'EN'; label: string }[]) => ({
  id: 'p-1',
  label: '1 Stück',
  translations,
});

describe('resolveFoodName', () => {
  let warn: jest.Mock;
  beforeEach(() => {
    warn = jest.fn();
  });

  it('returns the translation for the requested locale without logging', () => {
    const f = food({
      translations: [
        { locale: 'DE', name: 'Banane' },
        { locale: 'EN', name: 'Banana' },
      ],
    });
    expect(resolveFoodName(f, 'en', warn)).toBe('Banana');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['OPEN_FOOD_FACTS', 'USER'] as const)('never translates a %s food', (source) => {
    const f = food({ source, translations: [{ locale: 'EN', name: 'Stray' }] });
    expect(resolveFoodName(f, 'en', warn)).toBe('Banane');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the default locale and logs entity and locale', () => {
    const f = food({ translations: [{ locale: 'DE', name: 'Banane' }] });
    expect(resolveFoodName(f, 'en', warn)).toBe('Banane');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('f-1');
    expect(warn.mock.calls[0][0]).toContain('en');
  });

  it('falls back to any available row, then to the base name, logging each', () => {
    expect(
      resolveFoodName(food({ translations: [{ locale: 'EN', name: 'Banana' }] }), 'de', warn),
    ).toBe('Banana');
    expect(resolveFoodName(food(), 'en', warn)).toBe('Banane');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('resolvePortionLabel', () => {
  let warn: jest.Mock;
  beforeEach(() => {
    warn = jest.fn();
  });

  it('returns the translated label for a SEED food', () => {
    const p = portion([{ locale: 'EN', label: '1 piece' }]);
    expect(resolvePortionLabel(p, 'SEED', 'en', warn)).toBe('1 piece');
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves labels of non-SEED foods verbatim', () => {
    const p = portion([{ locale: 'EN', label: 'Stray' }]);
    expect(resolvePortionLabel(p, 'USER', 'en', warn)).toBe('1 Stück');
    expect(resolvePortionLabel(p, 'OPEN_FOOD_FACTS', 'en', warn)).toBe('1 Stück');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to default locale, any row, then base label, logging the gap', () => {
    expect(
      resolvePortionLabel(portion([{ locale: 'DE', label: '1 Stück' }]), 'SEED', 'en', warn),
    ).toBe('1 Stück');
    expect(resolvePortionLabel(portion([]), 'SEED', 'en', warn)).toBe('1 Stück');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('p-1');
  });
});
