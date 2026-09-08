import {
  MealSlotsService,
  DEFAULT_MEAL_SLOT_NAMES,
  defaultMealSlotCreateData,
} from './meal-slots.service';

/**
 * Every user's eating day starts divided into four Abschnitte (Frühstück, Mittagessen,
 * Abendessen, Snacks). Their `order` is 1-based and contiguous within the user -- the same
 * invariant `WorkoutDay.order` carries -- and one shared definition feeds both the
 * registration path and the existing-user backfill so the two cannot diverge.
 */
describe('defaultMealSlotCreateData — order invariant', () => {
  it('lists the four defaults in the documented display order', () => {
    expect(defaultMealSlotCreateData().map((s) => s.name)).toEqual([
      'Frühstück',
      'Mittagessen',
      'Abendessen',
      'Snacks',
    ]);
    expect(DEFAULT_MEAL_SLOT_NAMES).toHaveLength(4);
  });

  it('numbers them 1-based, contiguous, matching array position', () => {
    const rows = defaultMealSlotCreateData();
    rows.forEach((row, index) => expect(row.order).toBe(index + 1));
    expect(rows.map((r) => r.order)).toEqual([1, 2, 3, 4]);
  });

  it('returns a fresh array each call (no shared mutable state)', () => {
    const first = defaultMealSlotCreateData();
    first[0].order = 99;
    expect(defaultMealSlotCreateData()[0].order).toBe(1);
  });
});

describe('MealSlotsService.createDefaultsForUser', () => {
  function makeService() {
    const prisma = {
      mealSlot: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    return { service: new MealSlotsService(prisma as never), prisma };
  }

  it('inserts the four defaults for the given user with contiguous 1-based order', async () => {
    const { service, prisma } = makeService();

    await service.createDefaultsForUser('user-1');

    expect(prisma.mealSlot.createMany).toHaveBeenCalledWith({
      data: [
        { name: 'Frühstück', order: 1, userId: 'user-1' },
        { name: 'Mittagessen', order: 2, userId: 'user-1' },
        { name: 'Abendessen', order: 3, userId: 'user-1' },
        { name: 'Snacks', order: 4, userId: 'user-1' },
      ],
    });
  });
});
