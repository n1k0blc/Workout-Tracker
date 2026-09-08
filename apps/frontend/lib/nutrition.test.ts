import { describe, it, expect, afterAll } from 'vitest';
import {
  kcalFromMacros,
  macroConsistencyHint,
  addDays,
  formatMacroLine,
  formatKcal,
  relativeDayLabel,
  parseAmount,
  scalePer100,
  formatQuantityLabel,
} from './nutrition';

const originalTz = process.env.TZ;
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('kcalFromMacros', () => {
  it('applies 4 / 4 / 9 kcal per gram', () => {
    expect(kcalFromMacros({ carbs: 48, protein: 22, fat: 24 })).toBe(496);
    expect(kcalFromMacros({ carbs: 0, protein: 0, fat: 0 })).toBe(0);
    expect(kcalFromMacros({ carbs: 10, protein: 0, fat: 0 })).toBe(40);
    expect(kcalFromMacros({ carbs: 0, protein: 0, fat: 10 })).toBe(90);
  });

  it('rounds the total to a whole number', () => {
    expect(kcalFromMacros({ carbs: 1.2, protein: 0, fat: 0 })).toBe(5); // 4.8
    expect(kcalFromMacros({ carbs: 0, protein: 3.3, fat: 0 })).toBe(13); // 13.2
  });
});

describe('macroConsistencyHint', () => {
  it('states the macro-derived kcal and that the entered value is kept as-is', () => {
    expect(macroConsistencyHint(540, { carbs: 48, protein: 22, fat: 24 })).toBe(
      'Makros ergeben 496 kcal. Differenz zu 540 kcal wird übernommen wie eingegeben.',
    );
  });

  it('fires in both directions (macros above the entered kcal too)', () => {
    expect(macroConsistencyHint(400, { carbs: 48, protein: 22, fat: 24 })).toBe(
      'Makros ergeben 496 kcal. Differenz zu 400 kcal wird übernommen wie eingegeben.',
    );
  });

  it('is silent when the macros already match the entered kcal', () => {
    expect(macroConsistencyHint(90, { carbs: 0, protein: 0, fat: 10 })).toBeNull();
  });

  it('is silent when no usable kcal has been entered yet', () => {
    expect(macroConsistencyHint(0, { carbs: 48, protein: 22, fat: 24 })).toBeNull();
    expect(macroConsistencyHint(NaN, { carbs: 1, protein: 1, fat: 1 })).toBeNull();
  });
});

describe('addDays', () => {
  it('steps forward and back by whole days', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(addDays('2026-09-07', 1)).toBe('2026-09-08');
    expect(addDays('2026-09-07', -1)).toBe('2026-09-06');
    expect(addDays('2026-09-07', 0)).toBe('2026-09-07');
  });

  it('crosses month and year boundaries', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // leap year
  });

  it('is stable across a DST transition', () => {
    // Europe/Berlin springs forward on 2026-03-29.
    process.env.TZ = 'Europe/Berlin';
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
});

describe('formatMacroLine', () => {
  it('renders the "KH · P · F" summary with rounded grams', () => {
    expect(formatMacroLine({ carbs: 53, protein: 19.7, fat: 19.8 })).toBe(
      '53 g KH · 20 g P · 20 g F',
    );
  });
});

describe('formatKcal', () => {
  it('rounds and groups thousands the German way', () => {
    expect(formatKcal(1842)).toBe('1.842');
    expect(formatKcal(0)).toBe('0');
    expect(formatKcal(613.7)).toBe('614');
  });
});

describe('parseAmount', () => {
  it('reads plain and comma-decimal numbers', () => {
    expect(parseAmount('48')).toBe(48);
    expect(parseAmount('48,5')).toBe(48.5);
    expect(parseAmount(' 12.25 ')).toBe(12.25);
    expect(parseAmount('0')).toBe(0);
  });

  it('parses a free grams entry from the picker', () => {
    expect(parseAmount('173')).toBe(173);
    expect(parseAmount('173,5')).toBe(173.5);
  });

  it('returns null for blank, non-numeric or negative input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });
});

describe('scalePer100', () => {
  const oats = { kcal: 372, carbs: 58.7, protein: 13.5, fat: 7 };

  it('scales per-100 values by grams / 100', () => {
    const r = scalePer100(oats, 40);
    expect(r.kcal).toBeCloseTo(148.8, 6);
    expect(r.carbs).toBeCloseTo(23.48, 6);
    expect(r.protein).toBeCloseTo(5.4, 6);
    expect(r.fat).toBeCloseTo(2.8, 6);
  });

  it('is identity at 100 and zero at 0', () => {
    expect(scalePer100(oats, 100)).toEqual(oats);
    expect(scalePer100(oats, 0)).toEqual({ kcal: 0, carbs: 0, protein: 0, fat: 0 });
  });

  it('treats the amount as ml the same way (200 ml of a 59 kcal/100 ml drink)', () => {
    const r = scalePer100({ kcal: 59, carbs: 6.5, protein: 1, fat: 3 }, 200);
    expect(r.kcal).toBeCloseTo(118, 6);
    expect(r.carbs).toBeCloseTo(13, 6);
    expect(r.protein).toBeCloseTo(2, 6);
    expect(r.fat).toBeCloseTo(6, 6);
  });
});

describe('formatQuantityLabel', () => {
  it('wraps a named portion with its resolved amount', () => {
    expect(formatQuantityLabel('1 Portion', 40, false)).toBe('1 Portion (40 g)');
    expect(formatQuantityLabel('1 Glas', 200, true)).toBe('1 Glas (200 ml)');
  });

  it('is just the amount for a free entry', () => {
    expect(formatQuantityLabel(null, 150, false)).toBe('150 g');
    expect(formatQuantityLabel(null, 250, true)).toBe('250 ml');
  });

  it('rounds the displayed amount', () => {
    expect(formatQuantityLabel(null, 149.6, false)).toBe('150 g');
  });
});

describe('relativeDayLabel', () => {
  it('names today, yesterday and tomorrow', () => {
    expect(relativeDayLabel('2026-09-07', '2026-09-07')).toBe('Heute');
    expect(relativeDayLabel('2026-09-06', '2026-09-07')).toBe('Gestern');
    expect(relativeDayLabel('2026-09-08', '2026-09-07')).toBe('Morgen');
  });

  it('falls back to the weekday name further out', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(relativeDayLabel('2026-09-04', '2026-09-07')).toBe('Freitag');
  });
});
