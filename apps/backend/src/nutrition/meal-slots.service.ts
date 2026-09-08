import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The four Abschnitte every user starts with, in display order.
 *
 * One definition, shared by the two paths that create them -- the nested write in
 * `AuthService.register` for new users, and the backfill in migration
 * `20260908071941_add_nutrition_meal_slots_and_diary_entries` for existing ones -- so the
 * "1-based, contiguous `order`" invariant cannot drift between the two.
 */
export const DEFAULT_MEAL_SLOT_NAMES = [
  'Frühstück',
  'Mittagessen',
  'Abendessen',
  'Snacks',
] as const;

/**
 * `{ name, order }` rows for the default Abschnitte. `order` is the array position + 1 --
 * 1-based and contiguous, the same invariant `WorkoutDay.order` carries.
 */
export function defaultMealSlotCreateData(): { name: string; order: number }[] {
  return DEFAULT_MEAL_SLOT_NAMES.map((name, index) => ({ name, order: index + 1 }));
}

@Injectable()
export class MealSlotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates the four default Abschnitte for `userId`, from the same shared definition.
   *
   * The runtime paths that give a user their defaults are elsewhere -- a nested create in
   * `AuthService.register` for new accounts, the backfill in migration
   * `20260908071941_...` for accounts that predate the feature. This method is the recovery
   * seam: a user that slipped through both (created mid-deploy, a failed backfill) can be
   * repaired without hand-writing SQL, and it is what the service spec exercises.
   */
  async createDefaultsForUser(userId: string): Promise<void> {
    await this.prisma.mealSlot.createMany({
      data: defaultMealSlotCreateData().map((row) => ({ ...row, userId })),
    });
  }
}
