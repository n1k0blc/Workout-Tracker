import 'reflect-metadata';
import { CreateFoodDto } from './create-food.dto';
import { UpdateFoodDto } from './update-food.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';

const food = (overrides: Record<string, unknown> = {}) => ({
  name: 'Haferflocken',
  kcal: 372,
  carbs: 60,
  protein: 13,
  fat: 7,
  ...overrides,
});

const portion = (overrides: Record<string, unknown> = {}) => ({
  label: '1 Portion',
  grams: 40,
  ...overrides,
});

describe.each([
  ['CreateFoodDto', CreateFoodDto],
  ['UpdateFoodDto', UpdateFoodDto],
])('%s', (_name, dto) => {
  const run = (body: Record<string, unknown>) => throughPipe(dto as never, body);

  it('limits name and brand to 120 characters; only the name is required', async () => {
    expect((await run(food({ name: 'a'.repeat(120), brand: 'b'.repeat(120) }))).errors).toEqual([]);
    expect(constraintsOf((await run(food({ name: 'a'.repeat(121) }))).errors, 'name')).toEqual([
      'maxLength',
    ]);
    expect(constraintsOf((await run(food({ brand: 'b'.repeat(121) }))).errors, 'brand')).toEqual([
      'maxLength',
    ]);
    expect(constraintsOf((await run(food({ name: ' ' }))).errors, 'name')).toContain('isNotEmpty');
    expect((await run(food({ brand: '' }))).errors).toEqual([]);
    expect(constraintsOf((await run(food({ name: 'Ha\u0000fer' }))).errors, 'name')).toEqual([
      'noControlCharacters',
    ]);
  });

  it('keeps kcal between 0 and 900 with at most one decimal', async () => {
    expect((await run(food({ kcal: 0 }))).errors).toEqual([]);
    expect((await run(food({ kcal: 900, carbs: 0, protein: 0, fat: 100 }))).errors).toEqual([]);
    expect((await run(food({ kcal: 371.5 }))).errors).toEqual([]);
    expect(constraintsOf((await run(food({ kcal: 900.1 }))).errors, 'kcal')).toEqual(['max']);
    expect(constraintsOf((await run(food({ kcal: -0.1 }))).errors, 'kcal')).toEqual(['min']);
    expect(constraintsOf((await run(food({ kcal: 371.55 }))).errors, 'kcal')).toEqual([
      'maxDecimals',
    ]);
  });

  it.each(['carbs', 'protein', 'fat'])('keeps %s between 0 and 100 g per 100 g', async (macro) => {
    const only = { carbs: 0, protein: 0, fat: 0 };
    expect((await run(food({ ...only, [macro]: 100 }))).errors).toEqual([]);
    // Fat past 100 also breaks the sum; the field's own limit is reported either way.
    expect(constraintsOf((await run(food({ ...only, [macro]: 100.1 }))).errors, macro)).toContain(
      'max',
    );
    expect(constraintsOf((await run(food({ ...only, [macro]: -1 }))).errors, macro)).toEqual([
      'min',
    ]);
  });

  it('caps carbs + protein + fat at 100 g per 100 g', async () => {
    expect((await run(food({ carbs: 50, protein: 30, fat: 20 }))).errors).toEqual([]);
    expect((await run(food({ carbs: 33.3, protein: 33.3, fat: 33.4 }))).errors).toEqual([]);
    expect(
      constraintsOf((await run(food({ carbs: 50, protein: 30, fat: 20.1 }))).errors, 'fat'),
    ).toEqual(['macroSum']);
  });

  it('limits a Portionsgroesse label to 60 characters and its grams to 0.1-5000', async () => {
    const withPortion = (p: Record<string, unknown>) => run(food({ portions: [portion(p)] }));
    expect((await withPortion({ label: 'a'.repeat(60), grams: 0.1 })).errors).toEqual([]);
    expect((await withPortion({ grams: 5000 })).errors).toEqual([]);
    expect(
      constraintsOf((await withPortion({ label: 'a'.repeat(61) })).errors, 'portions.0.label'),
    ).toEqual(['maxLength']);
    expect(constraintsOf((await withPortion({ grams: 0.09 })).errors, 'portions.0.grams')).toEqual([
      'min',
    ]);
    expect(
      constraintsOf((await withPortion({ grams: 5000.1 })).errors, 'portions.0.grams'),
    ).toEqual(['max']);
  });

  it('takes an EAN-8, UPC-A or EAN-13 with a valid check digit and nothing else', async () => {
    for (const ok of ['73513537', '036000291452', '4006381333931']) {
      expect((await run(food({ barcode: ok }))).errors).toEqual([]);
    }
    expect((await run(food())).errors).toEqual([]); // optional
    for (const bad of [
      '4006381333932', // last valid length, check digit off by one
      '73513538',
      '036000291453',
      '7351353', // 7 digits
      '735135370', // 9 digits
      '40063813339310', // 14 digits: a GTIN-14 was accepted before
      'abcdefgh',
      '4006 381 333 931',
      '',
    ]) {
      expect([bad, constraintsOf((await run(food({ barcode: bad }))).errors, 'barcode')]).toEqual([
        bad,
        ['isBarcode'],
      ]);
    }
  });

  it('allows 10 Portionsgroessen and refuses 11', async () => {
    const portions = (n: number) =>
      Array.from({ length: n }, (_, i) => portion({ label: `P${i}` }));
    expect((await run(food({ portions: portions(10) }))).errors).toEqual([]);
    expect(constraintsOf((await run(food({ portions: portions(11) }))).errors, 'portions')).toEqual(
      ['arrayMaxSize'],
    );
  });
});
