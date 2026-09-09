import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MealSlotDto, MealSlotListDto } from './dto';

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

/**
 * Rejects a reorder payload whose `order` values disagree with their array position -- the
 * same rule as the workout tree's `assertOrderMatchesPosition`. Array position is
 * authoritative; normalising a mismatched payload would silently pick one of the two
 * sequences the client sent, discarding a reorder with no error.
 */
export function assertContiguousOrder(items: { order: number }[]): void {
  items.forEach((item, index) => {
    const expected = index + 1;
    if (item.order !== expected) {
      throw new BadRequestException(
        `Abschnitt-Reihenfolge muss 1-basiert, lückenlos und in Sende-Reihenfolge sein ` +
          `(Position ${index} erwartet ${expected}, erhielt ${item.order})`,
      );
    }
  });
}

type MealSlotRow = { id: string; name: string; order: number; archivedAt: Date | null };

function toDto(row: MealSlotRow): MealSlotDto {
  return { id: row.id, name: row.name, order: row.order, archived: row.archivedAt !== null };
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

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

  /** The manage sheet's data: active Abschnitte in display order, archived ones after. */
  async list(userId: string): Promise<MealSlotListDto> {
    const rows = (await this.prisma.mealSlot.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow[];
    return {
      active: rows.filter((r) => !r.archivedAt).map(toDto),
      archived: rows.filter((r) => r.archivedAt).map(toDto),
    };
  }

  /** Appends a new active Abschnitt after the existing ones. */
  async create(userId: string, name: string): Promise<MealSlotDto> {
    const rows = await this.loadRows(userId);
    const activeIds = rows.filter((r) => !r.archivedAt).map((r) => r.id);
    const archivedIds = rows.filter((r) => r.archivedAt).map((r) => r.id);
    const parkedOrder = rows.reduce((max, r) => Math.max(max, r.order), 0) + 1;

    const created = (await this.prisma.mealSlot.create({
      data: { userId, name, order: parkedOrder },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow;

    await this.renumber(userId, [...activeIds, created.id], archivedIds);
    return { id: created.id, name: created.name, order: activeIds.length + 1, archived: false };
  }

  /**
   * The active Abschnitt named `name`, creating it if the user has none -- the landing place
   * for a whole-day copy (#151) whose source Abschnitt has since been archived, so those
   * entries stay visible rather than vanishing into a read-only slot.
   */
  async ensureActiveSlot(userId: string, name: string): Promise<MealSlotDto> {
    const existing = (await this.prisma.mealSlot.findFirst({
      where: { userId, name, archivedAt: null },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow | null;
    if (existing) {
      return toDto(existing);
    }
    return this.create(userId, name);
  }

  async rename(userId: string, id: string, name: string): Promise<MealSlotDto> {
    await this.findOwned(userId, id);
    const updated = (await this.prisma.mealSlot.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow;
    return toDto(updated);
  }

  /**
   * Archives or unarchives an Abschnitt, then renumbers so the active set stays 1-based and
   * contiguous -- archiving closes the gap it left, unarchiving appends to the end. The last
   * remaining active Abschnitt cannot be archived: a day with no slots has nowhere to log.
   */
  async setArchived(userId: string, id: string, archived: boolean): Promise<MealSlotDto> {
    const slot = await this.findOwned(userId, id);
    const currentlyArchived = slot.archivedAt !== null;
    if (currentlyArchived === archived) {
      return toDto(slot);
    }

    if (archived) {
      const activeCount = await this.prisma.mealSlot.count({
        where: { userId, archivedAt: null },
      });
      if (activeCount <= 1) {
        throw new ConflictException('Mindestens ein Abschnitt muss aktiv bleiben');
      }
    }

    await this.prisma.mealSlot.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });

    const rows = await this.loadRows(userId);
    await this.renumber(
      userId,
      rows.filter((r) => !r.archivedAt).map((r) => r.id),
      rows.filter((r) => r.archivedAt).map((r) => r.id),
    );

    return toDto(await this.findOwned(userId, id));
  }

  /**
   * Sets the display order of the active Abschnitte. `slots` must be exactly the user's
   * current active Abschnitte, each `order` restating its array position (1-based,
   * contiguous) -- a mismatch is a 400, matching the workout-tree rule.
   */
  async reorder(
    userId: string,
    slots: { id: string; order: number }[],
  ): Promise<MealSlotListDto> {
    assertContiguousOrder(slots);

    const activeIds = slots.map((s) => s.id);
    const currentActive = (await this.prisma.mealSlot.findMany({
      where: { userId, archivedAt: null },
      select: { id: true },
    })) as { id: string }[];
    const currentSet = new Set(currentActive.map((s) => s.id));

    const sameSet =
      activeIds.length === currentSet.size &&
      new Set(activeIds).size === activeIds.length &&
      activeIds.every((id) => currentSet.has(id));
    if (!sameSet) {
      throw new BadRequestException(
        'slots muss genau die aktuell aktiven Abschnitte enthalten',
      );
    }

    const archivedIds = (
      (await this.prisma.mealSlot.findMany({
        where: { userId, archivedAt: { not: null } },
        orderBy: { order: 'asc' },
        select: { id: true },
      })) as { id: string }[]
    ).map((s) => s.id);

    await this.renumber(userId, activeIds, archivedIds);
    return this.list(userId);
  }

  private async loadRows(userId: string): Promise<MealSlotRow[]> {
    return (await this.prisma.mealSlot.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow[];
  }

  private async findOwned(userId: string, id: string): Promise<MealSlotRow> {
    const slot = (await this.prisma.mealSlot.findFirst({
      where: { id, userId },
      select: { id: true, name: true, order: true, archivedAt: true },
    })) as MealSlotRow | null;
    if (!slot) {
      throw new NotFoundException('Abschnitt nicht gefunden');
    }
    return slot;
  }

  /**
   * Rewrites every one of the user's Abschnitte to `order` 1..n+m -- active ids in the given
   * display order first, archived ids after. Two passes (all rows to negative, then to their
   * final value) because `MealSlot(userId, order)` is unique and a direct renumber would
   * collide the moment it moved one row onto a value another still holds.
   */
  private async renumber(
    userId: string,
    activeIds: string[],
    archivedIds: string[],
  ): Promise<void> {
    const ordered = [...activeIds, ...archivedIds];
    if (ordered.length === 0) return;

    await this.prisma.$transaction([
      ...ordered.map((id, index) =>
        this.prisma.mealSlot.update({
          where: { id },
          data: { order: -(index + 1) },
        }),
      ),
      ...ordered.map((id, index) =>
        this.prisma.mealSlot.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    ]);
  }
}
