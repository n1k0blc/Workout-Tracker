import { scalePer100 } from './nutrition.util';

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

  it('treats the amount as millilitres the same way (200 ml of a 59 kcal/100 ml drink)', () => {
    const r = scalePer100({ kcal: 59, carbs: 6.5, protein: 1, fat: 3 }, 200);
    expect(r.kcal).toBeCloseTo(118, 6);
    expect(r.carbs).toBeCloseTo(13, 6);
  });
});
