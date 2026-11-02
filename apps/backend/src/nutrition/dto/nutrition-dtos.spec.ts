import 'reflect-metadata';
import { CreateDiaryEntryDto } from './create-diary-entry.dto';
import { CreateDiaryEntriesBatchDto } from './create-diary-entries-batch.dto';
import { CreateDiaryEntriesFromMealDto } from './create-diary-entries-from-meal.dto';
import { UpdateDiaryEntryDto } from './update-diary-entry.dto';
import { CreateMealSlotDto, UpdateMealSlotDto } from './meal-slot.dto';
import { PickerScopeQueryDto } from './picker.dto';
import {
  CopySourceDatesQueryDto,
  NutritionAnalyticsQueryDto,
  NutritionDayQueryDto,
} from './nutrition-query.dto';
import { CreateFoodDto } from '../../foods/dto/create-food.dto';
import { CreateMealDto } from '../../meals/dto/create-meal.dto';
import { MealsQueryDto } from '../../meals/dto/meals-query.dto';
import { FoodsQueryDto, SimilarFoodsQueryDto } from '../../foods/dto/foods-query.dto';
import { constraintsOf, throughPipe } from '../../common/testing/through-pipe';
import { FOOD_NAME_MAX } from '../../common/validation/field-rules';

const quickEntry = (overrides: Record<string, unknown> = {}) => ({
  mealSlotId: 'slot-1',
  localDate: '2026-11-01',
  name: 'Kuchen',
  kcal: 300,
  carbs: 40,
  protein: 5,
  fat: 10,
  ...overrides,
});

describe('Schnelleintrag', () => {
  const run = (body: Record<string, unknown>) => throughPipe(CreateDiaryEntryDto, body);

  it('has the same name rule as a Lebensmittel, so "save as Lebensmittel" cannot fail on it', async () => {
    const asFood = (name: string) =>
      throughPipe(CreateFoodDto, { name, kcal: 1, carbs: 0, protein: 0, fat: 0 });
    for (const name of [
      'a'.repeat(FOOD_NAME_MAX),
      'a'.repeat(FOOD_NAME_MAX + 1),
      '  ',
      'a\nb',
      "M&M's",
    ]) {
      expect((await run(quickEntry({ name }))).errors.map((e) => e.property)).toEqual(
        (await asFood(name)).errors.map((e) => e.property),
      );
    }
    expect((await run(quickEntry({ name: 'a'.repeat(120) }))).errors).toEqual([]);
    expect(
      constraintsOf((await run(quickEntry({ name: 'a'.repeat(121) }))).errors, 'name'),
    ).toEqual(['maxLength']);
  });

  it('keeps kcal to 0-10000 and each macro to 0-1000 g', async () => {
    expect((await run(quickEntry({ kcal: 0, carbs: 0, protein: 0, fat: 0 }))).errors).toEqual([]);
    expect(
      (await run(quickEntry({ kcal: 10000, carbs: 1000, protein: 1000, fat: 1000 }))).errors,
    ).toEqual([]);
    expect(constraintsOf((await run(quickEntry({ kcal: 10000.1 }))).errors, 'kcal')).toEqual([
      'max',
    ]);
    for (const macro of ['carbs', 'protein', 'fat']) {
      expect(constraintsOf((await run(quickEntry({ [macro]: 1000.1 }))).errors, macro)).toEqual([
        'max',
      ]);
      expect(constraintsOf((await run(quickEntry({ [macro]: -1 }))).errors, macro)).toEqual([
        'min',
      ]);
    }
  });

  it('keeps the quantity to 0.1-5000 and the label to 60 characters', async () => {
    expect((await run(quickEntry({ quantity: 0.1 }))).errors).toEqual([]);
    expect((await run(quickEntry({ quantity: 5000 }))).errors).toEqual([]);
    expect(constraintsOf((await run(quickEntry({ quantity: 0.09 }))).errors, 'quantity')).toEqual([
      'min',
    ]);
    expect(constraintsOf((await run(quickEntry({ quantity: 5000.1 }))).errors, 'quantity')).toEqual(
      ['max'],
    );
    expect((await run(quickEntry({ quantityLabel: 'a'.repeat(60) }))).errors).toEqual([]);
    expect(
      constraintsOf(
        (await run(quickEntry({ quantityLabel: 'a'.repeat(61) }))).errors,
        'quantityLabel',
      ),
    ).toEqual(['maxLength']);
  });
});

describe('diary quantities', () => {
  it('limits grams in a basket item and a quantity change to 0.1-5000', async () => {
    const batch = (grams: number) =>
      throughPipe(CreateDiaryEntriesBatchDto, {
        mealSlotId: 'slot-1',
        localDate: '2026-11-01',
        items: [{ foodId: 'food-1', grams }],
      });
    expect((await batch(0.1)).errors).toEqual([]);
    expect((await batch(5000)).errors).toEqual([]);
    expect(constraintsOf((await batch(0.09)).errors, 'items.0.grams')).toEqual(['min']);
    expect(constraintsOf((await batch(5000.1)).errors, 'items.0.grams')).toEqual(['max']);

    const change = (quantity: number) => throughPipe(UpdateDiaryEntryDto, { quantity });
    expect((await change(0.1)).errors).toEqual([]);
    expect((await change(5000)).errors).toEqual([]);
    expect(constraintsOf((await change(0.09)).errors, 'quantity')).toEqual(['min']);
    expect(constraintsOf((await change(5000.1)).errors, 'quantity')).toEqual(['max']);
  });

  it('limits the meal factor to 0.5-20', async () => {
    const factor = (value: number) =>
      throughPipe(CreateDiaryEntriesFromMealDto, {
        mealSlotId: 's',
        localDate: '2026-11-01',
        mealId: 'm',
        factor: value,
      });
    expect((await factor(0.5)).errors).toEqual([]);
    expect((await factor(20)).errors).toEqual([]);
    expect(constraintsOf((await factor(0.49)).errors, 'factor')).toEqual(['min']);
    expect(constraintsOf((await factor(20.01)).errors, 'factor')).toEqual(['max']);
  });
});

describe('Mahlzeit', () => {
  const meal = (overrides: Record<string, unknown> = {}) => ({
    name: 'Porridge',
    items: [{ foodId: 'food-1', quantity: 50 }],
    ...overrides,
  });

  it('limits its name to 120 characters', async () => {
    expect((await throughPipe(CreateMealDto, meal({ name: 'a'.repeat(120) }))).errors).toEqual([]);
    expect(
      constraintsOf(
        (await throughPipe(CreateMealDto, meal({ name: 'a'.repeat(121) }))).errors,
        'name',
      ),
    ).toEqual(['maxLength']);
  });

  it('limits an ingredient quantity to 0.1-5000', async () => {
    const item = (quantity: number) =>
      throughPipe(CreateMealDto, meal({ items: [{ foodId: 'food-1', quantity }] }));
    expect((await item(0.1)).errors).toEqual([]);
    expect((await item(5000)).errors).toEqual([]);
    expect(constraintsOf((await item(0.09)).errors, 'items.0.quantity')).toEqual(['min']);
    expect(constraintsOf((await item(5000.1)).errors, 'items.0.quantity')).toEqual(['max']);
  });
});

describe('Abschnitt name', () => {
  it('is 1-60 characters on create and rename', async () => {
    for (const dto of [CreateMealSlotDto, UpdateMealSlotDto]) {
      const run = (name: string) => throughPipe(dto as never, { name });
      expect((await run('a'.repeat(60))).errors).toEqual([]);
      expect(constraintsOf((await run('a'.repeat(61))).errors, 'name')).toEqual(['maxLength']);
      expect(constraintsOf((await run(' ')).errors, 'name')).toContain('isNotEmpty');
    }
  });
});

describe('query parameters', () => {
  const query = <T>(dto: new () => T, q: Record<string, unknown>) =>
    throughPipe(dto, q, 'query', '');

  it('mine is a flag', async () => {
    for (const mine of ['1', 'true', '0', 'false']) {
      expect((await query(MealsQueryDto, { mine })).errors).toEqual([]);
    }
    expect(constraintsOf((await query(MealsQueryDto, { mine: 'yes' })).errors, 'mine')).toEqual([
      'isIn',
    ]);
  });

  it('search terms take any characters and stop at 100', async () => {
    for (const dto of [FoodsQueryDto]) {
      expect((await query(dto, { search: "7UP & M&M's" })).errors).toEqual([]);
      expect((await query(dto, { search: 'a'.repeat(100) })).errors).toEqual([]);
      expect(
        constraintsOf((await query(dto, { search: 'a'.repeat(101) })).errors, 'search'),
      ).toEqual(['maxLength']);
    }
    expect((await query(SimilarFoodsQueryDto, { name: 'a'.repeat(100) })).errors).toEqual([]);
    expect(
      constraintsOf((await query(SimilarFoodsQueryDto, { name: 'a'.repeat(101) })).errors, 'name'),
    ).toEqual(['maxLength']);
  });

  it('the picker scope is food or all', async () => {
    expect((await query(PickerScopeQueryDto, { scope: 'food' })).errors).toEqual([]);
    expect((await query(PickerScopeQueryDto, {})).errors).toEqual([]);
    expect(
      constraintsOf((await query(PickerScopeQueryDto, { scope: 'x' })).errors, 'scope'),
    ).toEqual(['isIn']);
  });
});

describe('nutrition query parameters', () => {
  const query = <T>(dto: new () => T, q: Record<string, unknown>) =>
    throughPipe(dto, q, 'query', '');

  describe('GET /nutrition/day', () => {
    it('takes no date, or a real calendar day', async () => {
      expect((await query(NutritionDayQueryDto, {})).errors).toEqual([]);
      expect((await query(NutritionDayQueryDto, { date: '2026-02-28' })).code).toBeUndefined();
      expect((await query(NutritionDayQueryDto, { date: '2024-02-29' })).ok).not.toBeNull();
    });

    it.each(['2026-02-30', '2026-2-3', '2026-11-01T10:00:00Z', '', 'abc', ['2026-11-01', '2026-11-02']])(
      'answers NUTRITION_DAY_DATE_INVALID for %j',
      async (date) => {
        const result = await query(NutritionDayQueryDto, { date });
        expect(result.ok).toBeNull();
        expect(result.code).toBe('NUTRITION_DAY_DATE_INVALID');
      },
    );

    it('refuses a parameter it does not know', async () => {
      const result = await query(NutritionDayQueryDto, { date: '2026-11-01', extra: '1' });
      expect(result.code).toBe('VALIDATION_FAILED');
      expect(constraintsOf(result.errors, 'extra')).toEqual(['whitelistValidation']);
    });
  });

  describe('GET /nutrition/analytics', () => {
    it('needs both ends as real calendar days', async () => {
      expect(
        (await query(NutritionAnalyticsQueryDto, { start: '2026-11-01', end: '2026-11-30' })).ok,
      ).not.toBeNull();
    });

    it.each([
      [{}],
      [{ start: '2026-11-01' }],
      [{ end: '2026-11-30' }],
      [{ start: '2026-11-31', end: '2026-12-01' }],
      [{ start: '2026-11-01', end: 'tomorrow' }],
    ])('answers NUTRITION_ANALYTICS_RANGE_INVALID for %j', async (q) => {
      const result = await query(NutritionAnalyticsQueryDto, q);
      expect(result.ok).toBeNull();
      expect(result.code).toBe('NUTRITION_ANALYTICS_RANGE_INVALID');
    });
  });

  describe('GET /nutrition/copy/source-dates', () => {
    it('takes no exclude, or a real calendar day', async () => {
      expect((await query(CopySourceDatesQueryDto, {})).errors).toEqual([]);
      expect((await query(CopySourceDatesQueryDto, { exclude: '2026-11-01' })).ok).not.toBeNull();
    });

    it.each(['2026-02-30', 'abc', '', '2026-11-01T10:00:00Z'])(
      'answers 400 for exclude=%j instead of ignoring it',
      async (exclude) => {
        const result = await query(CopySourceDatesQueryDto, { exclude });
        expect(result.ok).toBeNull();
        expect(result.code).toBe('VALIDATION_FAILED');
        expect(constraintsOf(result.errors, 'exclude')).toEqual(['isLocalDate']);
      },
    );
  });
});
