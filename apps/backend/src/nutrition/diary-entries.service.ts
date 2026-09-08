import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDiaryEntryDto,
  DiaryEntryDto,
  MacroTotals,
  NutritionDayDto,
  NutritionDaySlotDto,
} from './dto';

type DiaryEntryRow = {
  id: string;
  userId: string;
  mealSlotId: string;
  localDate: string;
  foodId: string | null;
  mealId: string | null;
  name: string;
  quantity: number;
  quantityLabel: string | null;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

type MealSlotRow = {
  id: string;
  name: string;
  order: number;
  archivedAt: Date | null;
};

const ZERO_TOTALS: MacroTotals = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

function addNutrients(a: MacroTotals, e: DiaryEntryRow | DiaryEntryDto): MacroTotals {
  return {
    kcal: a.kcal + e.kcal,
    carbs: a.carbs + e.carbs,
    protein: a.protein + e.protein,
    fat: a.fat + e.fat,
  };
}

function toEntryDto(row: DiaryEntryRow): DiaryEntryDto {
  return {
    id: row.id,
    mealSlotId: row.mealSlotId,
    localDate: row.localDate,
    foodId: row.foodId,
    mealId: row.mealId,
    name: row.name,
    quantity: row.quantity,
    quantityLabel: row.quantityLabel,
    kcal: row.kcal,
    carbs: row.carbs,
    protein: row.protein,
    fat: row.fat,
  };
}

@Injectable()
export class DiaryEntriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * The Tagesansicht read model for one calendar day: every Abschnitt the user has, each with
   * that day's entries and their totals, plus the whole-day totals. An archived Abschnitt
   * (#142) is included only when it already holds entries for `localDate`, so opening an old
   * day still shows what was eaten there.
   */
  async getDay(userId: string, localDate: string): Promise<NutritionDayDto> {
    const [slots, entries] = await Promise.all([
      this.prisma.mealSlot.findMany({
        where: { userId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, order: true, archivedAt: true },
      }) as Promise<MealSlotRow[]>,
      this.prisma.diaryEntry.findMany({
        where: { userId, localDate },
        orderBy: { createdAt: 'asc' },
      }) as Promise<DiaryEntryRow[]>,
    ]);

    const entriesBySlot = new Map<string, DiaryEntryRow[]>();
    for (const entry of entries) {
      const list = entriesBySlot.get(entry.mealSlotId) ?? [];
      list.push(entry);
      entriesBySlot.set(entry.mealSlotId, list);
    }

    const slotDtos: NutritionDaySlotDto[] = [];
    for (const slot of slots) {
      const slotEntries = entriesBySlot.get(slot.id) ?? [];
      if (slot.archivedAt && slotEntries.length === 0) continue;
      slotDtos.push({
        id: slot.id,
        name: slot.name,
        order: slot.order,
        archived: slot.archivedAt !== null,
        totals: slotEntries.reduce(addNutrients, { ...ZERO_TOTALS }),
        entries: slotEntries.map(toEntryDto),
      });
    }

    return {
      date: localDate,
      totals: entries.reduce(addNutrients, { ...ZERO_TOTALS }),
      slots: slotDtos,
    };
  }

  /**
   * Logs a Schnelleintrag: the given name and kcal/macros are stored verbatim as the snapshot,
   * with `foodId` and `mealId` null. `quantity` defaults to 1 when the client omits it.
   */
  async createEntry(userId: string, dto: CreateDiaryEntryDto): Promise<DiaryEntryDto> {
    const slot = await this.prisma.mealSlot.findFirst({
      where: { id: dto.mealSlotId, userId },
      select: { id: true, archivedAt: true },
    });
    if (!slot) {
      throw new NotFoundException('Abschnitt nicht gefunden');
    }
    // An archived Abschnitt is read-only: it still shows on past days that already have
    // entries in it, but nothing new can be logged into it (#142).
    if (slot.archivedAt) {
      throw new ConflictException('Abschnitt ist archiviert');
    }

    const entry = (await this.prisma.diaryEntry.create({
      data: {
        userId,
        mealSlotId: dto.mealSlotId,
        localDate: dto.localDate,
        name: dto.name,
        foodId: null,
        mealId: null,
        quantity: dto.quantity ?? 1,
        quantityLabel: dto.quantityLabel ?? null,
        kcal: dto.kcal,
        carbs: dto.carbs,
        protein: dto.protein,
        fat: dto.fat,
      },
    })) as DiaryEntryRow;

    return toEntryDto(entry);
  }

  /**
   * Rescales an Eintrag's snapshot proportionally to a new quantity: every nutrient is
   * multiplied by newQuantity / oldQuantity. The snapshot is never recomputed from a Food --
   * that is the whole point of storing it (see ADR-0002). Scoped to `userId`: another user's
   * entry is a 404, never a silent edit.
   */
  async updateEntryQuantity(
    userId: string,
    id: string,
    quantity: number,
  ): Promise<DiaryEntryDto> {
    const entry = (await this.prisma.diaryEntry.findFirst({
      where: { id, userId },
    })) as DiaryEntryRow | null;
    if (!entry) {
      throw new NotFoundException('Eintrag nicht gefunden');
    }

    const ratio = quantity / entry.quantity;
    const updated = (await this.prisma.diaryEntry.update({
      where: { id },
      data: {
        quantity,
        kcal: entry.kcal * ratio,
        carbs: entry.carbs * ratio,
        protein: entry.protein * ratio,
        fat: entry.fat * ratio,
      },
    })) as DiaryEntryRow;

    return toEntryDto(updated);
  }

  /**
   * Hard-deletes an Eintrag. The undo toast restores it by re-creating from the client's copy,
   * so there is no soft-delete state to carry. Scoped to `userId`.
   */
  async deleteEntry(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.diaryEntry.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Eintrag nicht gefunden');
    }
  }
}
