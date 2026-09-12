import { OffLookupService } from './off-lookup';

/**
 * The live Open Food Facts lookup behind a barcode scan (#149). It is the same mapping and
 * quality gate the bulk import uses, over one product fetched on demand -- with two
 * deliberate differences: the market filter does not apply (we cache whatever was physically
 * scanned) and an EAN-8 is kept (see `rejectOffNutrition`).
 */

const HAFERDRINK = {
  code: '4013200104108',
  product_name: 'Haferdrink Barista',
  brands: 'Oatly',
  quantity: '1 l',
  serving_size: '200 ml',
  categories_tags: ['en:beverages'],
  countries_tags: ['en:france'],
  nutriments: {
    'energy-kcal_100g': 59,
    carbohydrates_100g: 6.5,
    proteins_100g: 1,
    fat_100g: 3,
  },
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(impl: (url: string, options: RequestInit) => Promise<unknown>) {
  const fn = jest.fn(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function makeService(response: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = mockFetch(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => response,
  }));
  return { service: new OffLookupService(), fetchMock };
}

describe('OffLookupService.lookup', () => {
  it('maps a found product the same way the import does', async () => {
    const { service } = makeService({ status: 1, product: HAFERDRINK });

    expect(await service.lookup('4013200104108')).toEqual({
      barcode: '4013200104108',
      name: 'Haferdrink Barista',
      brand: 'Oatly',
      isLiquid: true,
      kcal: 59,
      carbs: 6.5,
      protein: 1,
      fat: 3,
      portions: [{ label: '1 Portion', grams: 200, isDefault: true }],
    });
  });

  it('keeps a product not sold in Germany -- the user scanned it, so they have it', async () => {
    const { service } = makeService({ status: 1, product: HAFERDRINK });
    // countries_tags above is en:france only; the bulk import would drop it.
    expect(await service.lookup('4013200104108')).not.toBeNull();
  });

  it('keeps a checksum-valid EAN-8, which the bulk import turns away', async () => {
    const { service } = makeService({
      status: 1,
      product: { ...HAFERDRINK, code: '96385074' },
    });
    expect(await service.lookup('96385074')).toMatchObject({ barcode: '96385074' });
  });

  it('asks Open Food Facts for the barcode it was given, identifying the app', async () => {
    const { service, fetchMock } = makeService({ status: 1, product: HAFERDRINK });
    await service.lookup('4013200104108');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v2/product/4013200104108');
    expect((options.headers as Record<string, string>)['User-Agent']).toMatch(/Workout-Tracker/);
  });

  it('is a miss when Open Food Facts does not know the product', async () => {
    const { service } = makeService({ status: 0 });
    expect(await service.lookup('4013200104108')).toBeNull();
  });

  it('is a miss when the product fails the shared quality gate', async () => {
    const { service } = makeService({
      status: 1,
      // 900 kcal stated against macros implying ~40 -- the energy cross-check rejects it.
      product: {
        ...HAFERDRINK,
        nutriments: {
          'energy-kcal_100g': 900,
          carbohydrates_100g: 1,
          proteins_100g: 1,
          fat_100g: 1,
        },
      },
    });
    expect(await service.lookup('4013200104108')).toBeNull();
  });

  it('is a miss, not a failure, when Open Food Facts is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ETIMEDOUT')));
    await expect(new OffLookupService().lookup('4013200104108')).resolves.toBeNull();
  });

  it('is a miss when Open Food Facts answers with an error status', async () => {
    const { service } = makeService({}, { ok: false, status: 503 });
    expect(await service.lookup('4013200104108')).toBeNull();
  });
});
