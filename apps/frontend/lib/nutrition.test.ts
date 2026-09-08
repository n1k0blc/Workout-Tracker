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
  foodSourceLabel,
  buildQuantityStops,
  defaultQuantityStopIndex,
  formatFactor,
  scaleMacros,
  computeMealTotals,
  mealIngredientPreview,
  groupDiaryEntries,
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

describe('foodSourceLabel', () => {
  it('marks the current user\'s own food', () => {
    expect(foodSourceLabel({ editable: true, source: 'USER' })).toBe('Eigenes');
  });

  it('marks seeded and imported foods', () => {
    expect(foodSourceLabel({ editable: false, source: 'SEED' })).toBe('System');
    expect(foodSourceLabel({ editable: false, source: 'OPEN_FOOD_FACTS' })).toBe(
      'Open Food Facts',
    );
  });

  it('shows nothing for another user\'s food', () => {
    expect(foodSourceLabel({ editable: false, source: 'USER' })).toBeNull();
  });
});

describe('buildQuantityStops', () => {
  it('lists portions in order, then gram presets that do not duplicate one', () => {
    const stops = buildQuantityStops([
      { label: '1 Esslöffel', grams: 12, order: 2 },
      { label: '1 Portion', grams: 50, order: 1 },
    ]);
    expect(stops).toEqual([
      { label: '1 Portion', grams: 50 },
      { label: '1 Esslöffel', grams: 12 },
      { label: null, grams: 25 },
      { label: null, grams: 100 },
      { label: null, grams: 150 },
      { label: null, grams: 200 },
      { label: null, grams: 250 },
      { label: null, grams: 300 },
    ]);
  });

  it('is just the gram presets when a food has no portions', () => {
    expect(buildQuantityStops([]).map((s) => s.grams)).toEqual([
      25, 50, 100, 150, 200, 250, 300,
    ]);
  });
});

describe('defaultQuantityStopIndex', () => {
  const stops = buildQuantityStops([
    { label: '1 Portion', grams: 40, order: 1 },
    { label: '1 Esslöffel', grams: 12, order: 2 },
  ]);

  it('lands on the default portion when there is one', () => {
    expect(defaultQuantityStopIndex(stops, '1 Portion')).toBe(0);
  });

  it('falls back to the stop nearest 100 with no default', () => {
    // stops: 40, 12, 25, 50, 100, 150, 200, 250, 300 -> "100" is index 4
    expect(defaultQuantityStopIndex(stops, null)).toBe(4);
  });
});

describe('formatFactor', () => {
  it('formats a multiplier the German way', () => {
    expect(formatFactor(0.5)).toBe('0,5×');
    expect(formatFactor(1)).toBe('1×');
    expect(formatFactor(1.5)).toBe('1,5×');
    expect(formatFactor(2)).toBe('2×');
  });
});

describe('scaleMacros', () => {
  it('multiplies every macro by the factor', () => {
    expect(scaleMacros({ kcal: 312, carbs: 40, protein: 23, fat: 6 }, 1.5)).toEqual({
      kcal: 468,
      carbs: 60,
      protein: 34.5,
      fat: 9,
    });
  });

  it('is identity at 1 and zero at 0', () => {
    const m = { kcal: 100, carbs: 10, protein: 5, fat: 2 };
    expect(scaleMacros(m, 1)).toEqual(m);
    expect(scaleMacros(m, 0)).toEqual({ kcal: 0, carbs: 0, protein: 0, fat: 0 });
  });
});

describe('computeMealTotals', () => {
  const oats = { per100: { kcal: 372, carbs: 58.7, protein: 13.5, fat: 7 }, quantity: 40 };
  const skyr = { per100: { kcal: 63, carbs: 4, protein: 11, fat: 0.2 }, quantity: 150 };

  it('sums each ingredient scaled by quantity / 100 (per 1x)', () => {
    const t = computeMealTotals([oats, skyr]);
    expect(t.kcal).toBeCloseTo(243.3, 6); // 372*0.4 + 63*1.5
    expect(t.carbs).toBeCloseTo(29.48, 6); // 58.7*0.4 + 4*1.5
    expect(t.protein).toBeCloseTo(21.9, 6); // 13.5*0.4 + 11*1.5
    expect(t.fat).toBeCloseTo(3.1, 6); // 7*0.4 + 0.2*1.5
  });

  it('is all zero for a meal with no ingredients', () => {
    expect(computeMealTotals([])).toEqual({ kcal: 0, carbs: 0, protein: 0, fat: 0 });
  });

  it('treats a liquid ingredient (ml) the same way', () => {
    const drink = { per100: { kcal: 59, carbs: 6.5, protein: 1, fat: 3 }, quantity: 200 };
    expect(computeMealTotals([drink]).kcal).toBeCloseTo(118, 6);
  });
});

describe('mealIngredientPreview', () => {
  it('lists the first names and appends " +N" for the rest', () => {
    expect(
      mealIngredientPreview(['Reis', 'Hähnchen', 'Paprika', 'Zwiebel', 'Öl', 'Salz']),
    ).toBe('Reis, Hähnchen, Paprika +3');
  });

  it('shows every name when there are no more than the cap', () => {
    expect(mealIngredientPreview(['Haferflocken', 'Kuhmilch', 'Skyr'])).toBe(
      'Haferflocken, Kuhmilch, Skyr',
    );
    expect(mealIngredientPreview(['Reis', 'Hähnchen'])).toBe('Reis, Hähnchen');
  });

  it('respects a custom cap', () => {
    expect(mealIngredientPreview(['a', 'b', 'c', 'd'], 2)).toBe('a, b +2');
  });

  it('is empty for a meal with no ingredients', () => {
    expect(mealIngredientPreview([])).toBe('');
  });
});

describe('groupDiaryEntries', () => {
  const e = (
    id: string,
    over: Partial<{ mealId: string | null; mealName: string | null; kcal: number }> = {},
  ) => ({ id, mealId: null, mealName: null, kcal: 100, ...over });

  it('groups one meal\'s ingredient entries and sums its kcal', () => {
    const entries = [
      e('a', { mealId: 'm1', mealName: 'Overnight Oats', kcal: 149 }),
      e('b', { mealId: 'm1', mealName: 'Overnight Oats', kcal: 96 }),
      e('c', { mealId: 'm1', mealName: 'Overnight Oats', kcal: 67 }),
      e('d', { kcal: 85 }),
    ];

    const { mealGroups, singles } = groupDiaryEntries(entries);

    expect(mealGroups).toHaveLength(1);
    expect(mealGroups[0]).toMatchObject({ mealId: 'm1', mealName: 'Overnight Oats', kcal: 312 });
    expect(mealGroups[0].entries.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(singles.map((x) => x.id)).toEqual(['d']);
  });

  it('groups by mealId regardless of position -- an interleaved single stays a single', () => {
    const entries = [
      e('a', { mealId: 'm1', mealName: 'Quark-Snack', kcal: 100 }),
      e('b', { kcal: 50 }),
      e('c', { mealId: 'm1', mealName: 'Quark-Snack', kcal: 100 }),
    ];

    const { mealGroups, singles } = groupDiaryEntries(entries);

    expect(mealGroups).toHaveLength(1);
    expect(mealGroups[0].entries.map((x) => x.id)).toEqual(['a', 'c']);
    expect(mealGroups[0].kcal).toBe(200);
    expect(singles.map((x) => x.id)).toEqual(['b']);
  });

  it('keeps two different meals as two groups, in first-seen order', () => {
    const entries = [
      e('a', { mealId: 'm2', mealName: 'Reis mit Hähnchen', kcal: 300 }),
      e('b', { mealId: 'm1', mealName: 'Overnight Oats', kcal: 100 }),
      e('c', { mealId: 'm2', mealName: 'Reis mit Hähnchen', kcal: 200 }),
    ];

    const { mealGroups } = groupDiaryEntries(entries);

    expect(mealGroups.map((g) => g.mealId)).toEqual(['m2', 'm1']);
    expect(mealGroups[0].kcal).toBe(500);
  });

  it('falls back to single rows when the meal name no longer resolves', () => {
    const entries = [
      e('a', { mealId: 'gone', mealName: null, kcal: 100 }),
      e('b', { mealId: 'gone', mealName: null, kcal: 100 }),
    ];

    const { mealGroups, singles } = groupDiaryEntries(entries);

    expect(mealGroups).toHaveLength(0);
    expect(singles.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('handles a day with no entries', () => {
    expect(groupDiaryEntries([])).toEqual({ mealGroups: [], singles: [] });
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
