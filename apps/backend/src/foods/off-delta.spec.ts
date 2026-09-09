import * as zlib from 'zlib';
import { Readable } from 'stream';
import { emptyFunnel, planDeltaSync, readDeltaProducts } from './off-delta';

/**
 * The delta half of the weekly sync (#150). Open Food Facts publishes one gzipped JSONL file
 * per day and keeps about 13 of them, so the two things worth testing here are picking the
 * right files out of the index and streaming one of them through the shared filter.
 */

// Real names from https://static.openfoodfacts.org/data/delta/index.txt: the window is a pair
// of unix seconds, and the index lists the newest file first.
const INDEX = [
  'openfoodfacts_products_1788847691_1788934590.json.gz',
  'openfoodfacts_products_1788761472_1788847691.json.gz',
  'openfoodfacts_products_1788675653_1788761472.json.gz',
].join('\n');

describe('planDeltaSync', () => {
  it('takes the files whose window ends after the marker, oldest first', () => {
    const plan = planDeltaSync(INDEX, 1788761472);

    expect(plan.files.map((file) => file.name)).toEqual([
      'openfoodfacts_products_1788761472_1788847691.json.gz',
      'openfoodfacts_products_1788847691_1788934590.json.gz',
    ]);
    expect(plan.marker).toBe(1788934590);
    expect(plan.warning).toBeNull();
  });

  it('never moves the marker backwards, so a bootstrap ahead of the deltas stays put', () => {
    // The marker can start ahead of every published window: with no state file the sync
    // resumes from the newest lastSyncedAt, and a bulk import that ran an hour ago is newer
    // than the delta generated this morning.
    const plan = planDeltaSync(INDEX, 1788999999);

    expect(plan.files).toEqual([]);
    expect(plan.marker).toBe(1788999999);
  });

  it('has nothing to do when the marker is level with the newest file', () => {
    const plan = planDeltaSync(INDEX, 1788934590);

    expect(plan.files).toEqual([]);
    expect(plan.marker).toBe(1788934590);
    expect(plan.warning).toBeNull();
  });

  it('warns about the uncovered window when the marker predates the oldest file kept', () => {
    const plan = planDeltaSync(INDEX, 1788000000);

    expect(plan.files).toHaveLength(3);
    expect(plan.warning).toContain('import:off');
  });

  it('takes every file kept and warns when there is no marker at all', () => {
    const plan = planDeltaSync(INDEX, null);

    expect(plan.files).toHaveLength(3);
    expect(plan.warning).toContain('import:off');
  });

  it('ignores blank lines and anything not shaped like a delta file', () => {
    const plan = planDeltaSync(`\n${INDEX}\nindex.txt\n\n`, 1788847691);

    expect(plan.files.map((file) => file.name)).toEqual([
      'openfoodfacts_products_1788847691_1788934590.json.gz',
    ]);
  });

  it('keeps the marker where it is when the index cannot be read', () => {
    const plan = planDeltaSync('', 1788847691);

    expect(plan.files).toEqual([]);
    expect(plan.marker).toBe(1788847691);
    expect(plan.warning).toContain('no delta files');
  });
});

/** One product in the shape the JSONL export and the deltas publish, per 100 g as sold. */
function deltaProduct(overrides: Record<string, unknown> = {}) {
  return {
    code: '4025500287955',
    product_name: 'Kalinka Kefir Fettarm Mild Pur',
    brands: 'müller',
    quantity: '500g',
    serving_size: '500 g',
    categories_tags: ['en:dairies', 'en:beverages', 'en:kefir'],
    countries_tags: ['en:germany'],
    nutrition: {
      input_sets: [
        {
          per_quantity: 100,
          preparation: 'as_sold',
          source: 'packaging',
          nutrients: {
            'energy-kcal': { value: 46 },
            carbohydrates: { value: 4.1 },
            proteins: { value: 3.4 },
            fat: { value: 1.5 },
          },
        },
      ],
    },
    ...overrides,
  };
}

function gzippedJsonl(products: Record<string, unknown>[]): Readable {
  const body = products.map((product) => JSON.stringify(product)).join('\n');
  return Readable.from([zlib.gzipSync(Buffer.from(body, 'utf8'))]);
}

async function collect(products: Record<string, unknown>[]) {
  const funnel = emptyFunnel();
  const mapped = [];
  for await (const product of readDeltaProducts(gzippedJsonl(products), funnel)) {
    mapped.push(product);
  }
  return { mapped, funnel };
}

describe('readDeltaProducts', () => {
  it('maps a German product that passes the quality gate', async () => {
    const { mapped, funnel } = await collect([deltaProduct()]);

    expect(mapped).toEqual([
      {
        barcode: '4025500287955',
        name: 'Kalinka Kefir Fettarm Mild Pur',
        brand: 'müller',
        isLiquid: true,
        kcal: 46,
        carbs: 4.1,
        protein: 3.4,
        fat: 1.5,
        portions: [{ label: '1 Portion', grams: 500, isDefault: true }],
      },
    ]);
    expect(funnel).toEqual({ products: 1, unmapped: 0, notGerman: 0, rejected: 0, importable: 1 });
  });

  it('counts the products it drops, one bucket per reason', async () => {
    const { mapped, funnel } = await collect([
      deltaProduct(),
      // No usable nutrient set: the legacy block Open Food Facts emptied, and nothing else.
      deltaProduct({ code: '4004480000012', nutrition: { input_sets: [] } }),
      deltaProduct({ code: '4004480000029', countries_tags: ['en:france'] }),
      // Macros imply 246 kcal, far outside the ±15% the seed CSV allows (#145).
      deltaProduct({
        code: '4004480000036',
        nutrition: {
          input_sets: [
            {
              per_quantity: 100,
              preparation: 'as_sold',
              source: 'packaging',
              nutrients: {
                'energy-kcal': { value: 46 },
                carbohydrates: { value: 40 },
                proteins: { value: 20 },
                fat: { value: 2 },
              },
            },
          ],
        },
      }),
    ]);

    expect(mapped).toHaveLength(1);
    expect(funnel).toEqual({ products: 4, unmapped: 1, notGerman: 1, rejected: 1, importable: 1 });
  });

  it('fails the run on a truncated download rather than reporting a short file', async () => {
    // readline ends quietly when its input is destroyed, so without the error being carried
    // out of the loop a half-downloaded file would look like a complete, smaller one -- and
    // the marker would advance past the products it never saw.
    const complete = zlib.gzipSync(Buffer.from(JSON.stringify(deltaProduct()), 'utf8'));
    const truncated = Readable.from([complete.subarray(0, complete.length - 5)]);

    await expect(
      (async () => {
        for await (const _ of readDeltaProducts(truncated, emptyFunnel())) void _;
      })(),
    ).rejects.toThrow();
  });

  it('skips a blank or unparseable line instead of failing the whole file', async () => {
    const body = [JSON.stringify(deltaProduct()), '', '{ not json'].join('\n');
    const funnel = emptyFunnel();
    const mapped = [];

    for await (const product of readDeltaProducts(
      Readable.from([zlib.gzipSync(Buffer.from(body, 'utf8'))]),
      funnel,
    )) {
      mapped.push(product);
    }

    expect(mapped).toHaveLength(1);
    expect(funnel.products).toBe(1);
  });
});
