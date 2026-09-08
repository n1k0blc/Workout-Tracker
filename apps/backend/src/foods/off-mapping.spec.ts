import {
  fromApiProduct,
  fromCsvRow,
  fromExportProduct,
  isSoldInGermany,
  mapOffProduct,
  OffProduct,
  rejectOffProduct,
} from './off-mapping';

/**
 * Open Food Facts mapping (#146). The pure product -> Food mapping and the quality filter,
 * shared by the bulk import, the weekly delta sync (#150) and the live barcode lookup (#149).
 * Fixtures are real products taken from the German subset of the export.
 */

function offProduct(overrides: Partial<OffProduct> = {}): OffProduct {
  return {
    barcode: '4025500287955',
    name: 'Kalinka Kefir Fettarm Mild Pur',
    brand: 'müller',
    quantity: '500g',
    servingSize: '500 g',
    categoriesTags: ['en:dairies', 'en:beverages', 'en:kefir'],
    countriesTags: ['en:germany'],
    kcal: 46,
    carbs: 4.1,
    protein: 3.4,
    fat: 1.5,
    ...overrides,
  };
}

describe('mapOffProduct', () => {
  it('maps a product to a Food row, per 100 ml for a beverage', () => {
    expect(mapOffProduct(offProduct())).toEqual({
      barcode: '4025500287955',
      name: 'Kalinka Kefir Fettarm Mild Pur',
      brand: 'müller',
      isLiquid: true,
      kcal: 46,
      carbs: 4.1,
      protein: 3.4,
      fat: 1.5,
      portions: [{ label: '1 Portion', grams: 500, isDefault: true }],
    });
  });
});

describe('mapOffProduct — values from the raw export', () => {
  it('rounds the float noise the export carries', () => {
    // Real values from the CSV export: a granola stored with full float error.
    const mapped = mapOffProduct(
      offProduct({
        kcal: 580.645161290323,
        carbs: 19.3548387096774,
        protein: 7.30000019073486,
        fat: 54.8387096774194,
      }),
    );

    expect(mapped).toMatchObject({ kcal: 581, carbs: 19.4, protein: 7.3, fat: 54.8 });
  });

  it('treats a product sold in millilitres as liquid even without a beverage category', () => {
    const mapped = mapOffProduct(
      offProduct({ categoriesTags: ['en:sauces'], quantity: '500 ml', servingSize: null }),
    );

    expect(mapped.isLiquid).toBe(true);
  });

  it('has no portions when the serving size carries no readable amount', () => {
    expect(mapOffProduct(offProduct({ servingSize: '1 Riegel' })).portions).toEqual([]);
    expect(mapOffProduct(offProduct({ servingSize: null })).portions).toEqual([]);
  });

  it('keeps a solid product in grams', () => {
    const mapped = mapOffProduct(
      offProduct({ categoriesTags: ['en:snacks'], quantity: '250 g', servingSize: '30 g' }),
    );

    expect(mapped.isLiquid).toBe(false);
    expect(mapped.portions).toEqual([{ label: '1 Portion', grams: 30, isDefault: true }]);
  });
});

describe('rejectOffProduct — the quality gate', () => {
  it('accepts a well-formed product', () => {
    expect(rejectOffProduct(offProduct())).toBeNull();
  });

  it.each([
    ['no name', { name: '   ' }, /name/],
    ['negative macro', { fat: -1 }, /negative/],
    ['impossible kcal', { kcal: 1200 }, /per-100/],
    ['impossible macro', { carbs: 140 }, /per-100/],
    ['barcode that is not an EAN', { barcode: '00001001' }, /barcode/],
    ['barcode failing its checksum', { barcode: '4025500287956' }, /barcode/],
    // 8-digit codes are a valid EAN-8 in principle, but in this dataset they are almost
    // entirely internal and test codes ("Fit Piggy Snickers Twist"), ~9% of otherwise
    // importable rows. A genuine short code is rare enough to lose.
    ['a checksum-valid 8-digit code', { barcode: '00001014' }, /13 digits/],
  ])('rejects %s', (_label, overrides, reason) => {
    expect(rejectOffProduct(offProduct(overrides))).toMatch(reason);
  });

  it('rejects macros that disagree with the stated kcal by more than 15%', () => {
    // 4*10 + 4*10 + 9*10 = 170 kcal of macros declared as 40.
    expect(rejectOffProduct(offProduct({ kcal: 40, carbs: 10, protein: 10, fat: 10 }))).toMatch(
      /kcal/,
    );
  });

  it('accepts a zero-kcal product with no macros, such as mineral water', () => {
    expect(
      rejectOffProduct(
        offProduct({ barcode: '4004480000013', kcal: 0, carbs: 0, protein: 0, fat: 0 }),
      ),
    ).toBeNull();
  });
});

/**
 * The same product as Open Food Facts publishes it in each of its three shapes. The parity
 * test below is the guard for #150: a row imported from the CSV and later updated from a
 * delta must normalize identically, or the sync churns rows that did not change.
 */
const CSV_ROW: Record<string, string> = {
  code: '4025500287955',
  product_name: 'Kalinka Kefir Fettarm Mild Pur',
  generic_name: 'Fettarmer Kefir mild, 1,5% Fettanteil',
  brands: 'müller',
  quantity: '500g',
  serving_size: '500 g',
  categories_tags: 'en:dairies,en:beverages,en:kefir',
  countries_tags: 'en:germany,en:switzerland',
  'energy-kcal_100g': '46',
  carbohydrates_100g: '4.1',
  proteins_100g: '3.4',
  fat_100g: '1.5',
};

const EXPORT_PRODUCT = {
  code: '4025500287955',
  product_name: 'Kalinka Kefir Fettarm Mild Pur',
  brands: 'müller',
  quantity: '500g',
  serving_size: '500 g',
  categories_tags: ['en:dairies', 'en:beverages', 'en:kefir'],
  countries_tags: ['en:germany', 'en:switzerland'],
  nutriments: {},
  nutrition: {
    input_sets: [
      {
        per_quantity: 100,
        preparation: 'as_sold',
        source: 'estimate',
        nutrients: {
          'energy-kcal': { value: 51, unit: 'kcal' },
          carbohydrates: { value: 5 },
          proteins: { value: 3 },
          fat: { value: 2 },
        },
      },
      {
        per_quantity: 100,
        preparation: 'as_sold',
        source: 'packaging',
        nutrients: {
          'energy-kcal': { value: 46, value_computed: 43.5, unit: 'kcal' },
          carbohydrates: { value: 4.1 },
          proteins: { value: 3.4 },
          fat: { value: 1.5 },
        },
      },
    ],
  },
};

const API_PRODUCT = {
  code: '4025500287955',
  product_name: 'Kalinka Kefir Fettarm Mild Pur',
  brands: 'müller',
  quantity: '500g',
  serving_size: '500 g',
  categories_tags: ['en:dairies', 'en:beverages', 'en:kefir'],
  countries_tags: ['en:germany', 'en:switzerland'],
  nutriments: {
    'energy-kcal_100g': 46,
    carbohydrates_100g: 4.1,
    proteins_100g: 3.4,
    fat_100g: 1.5,
  },
};

describe('source adapters', () => {
  it('reads a CSV export row', () => {
    expect(fromCsvRow(CSV_ROW)).toEqual(
      offProduct({ countriesTags: ['en:germany', 'en:switzerland'] }),
    );
  });

  it('reads an export/delta product, preferring packaging over the ingredient estimate', () => {
    expect(fromExportProduct(EXPORT_PRODUCT)).toEqual(
      offProduct({ countriesTags: ['en:germany', 'en:switzerland'] }),
    );
  });

  it('reads an API product from the legacy nutriments block', () => {
    expect(fromApiProduct(API_PRODUCT)).toEqual(
      offProduct({ countriesTags: ['en:germany', 'en:switzerland'] }),
    );
  });

  it('all three shapes of one product normalize identically', () => {
    const fromCsv = fromCsvRow(CSV_ROW);

    expect(fromExportProduct(EXPORT_PRODUCT)).toEqual(fromCsv);
    expect(fromApiProduct(API_PRODUCT)).toEqual(fromCsv);
    expect(mapOffProduct(fromExportProduct(EXPORT_PRODUCT))).toEqual(mapOffProduct(fromCsv));
  });

  it('returns null when an export product has no usable nutrient set', () => {
    expect(fromExportProduct({ ...EXPORT_PRODUCT, nutrition: { input_sets: [] } })).toBeNull();
    expect(
      fromExportProduct({
        ...EXPORT_PRODUCT,
        nutrition: {
          input_sets: [
            { per_quantity: 30, preparation: 'as_sold', source: 'packaging', nutrients: {} },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe('isSoldInGermany', () => {
  it('accepts a product tagged as sold in Germany, among other countries', () => {
    expect(isSoldInGermany(offProduct({ countriesTags: ['en:france', 'en:germany'] }))).toBe(true);
  });

  it('rejects a product not tagged for Germany', () => {
    expect(isSoldInGermany(offProduct({ countriesTags: ['en:france'] }))).toBe(false);
    expect(isSoldInGermany(offProduct({ countriesTags: [] }))).toBe(false);
  });

  it('is separate from the quality gate, so a live barcode scan can keep a foreign product', () => {
    // #149 caches whatever the user physically scanned; only the import and the sync (#150)
    // narrow the library to the German market.
    const foreign = offProduct({ countriesTags: ['en:france'] });

    expect(rejectOffProduct(foreign)).toBeNull();
    expect(isSoldInGermany(foreign)).toBe(false);
  });
});
