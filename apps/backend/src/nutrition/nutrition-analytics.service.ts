import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addLocalDays, weekdayOfLocalDate } from '../common/utils/today.util';
import {
  toMacroTargetsDto,
  UserTargetsRow,
  USER_TARGETS_SELECT,
} from './nutrition-targets.util';
import { NutritionTrendDayDto, NutritionTrendDto } from './dto';

/** The widest range the daily series will zero-fill -- a leap year's worth of days. */
const MAX_RANGE_DAYS = 366;

type EntryRow = {
  localDate: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

@Injectable()
export class NutritionAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * The Ernährungs-Analytics daily series (#153): summed kcal/Kohlenhydrate/Protein/Fett for
   * every calendar day in `[start, end]` (both `YYYY-MM-DD`, inclusive), a day the user logged
   * nothing on present with all totals 0 so the chart line never breaks. The range comes in
   * as the client's own calendar dates, so aggregating by the stored `localDate` keeps the
   * series in the client's timezone. The Tagesziele (#152) ride along for the target line.
   */
  async getTrend(userId: string, start: string, end: string): Promise<NutritionTrendDto> {
    if (end < start) {
      throw new BadRequestException('end darf nicht vor start liegen');
    }

    // Zero-fill first: this also bounds the response (an over-long range is a 400, not an
    // unbounded array).
    const days: NutritionTrendDayDto[] = [];
    for (let date = start; date <= end; date = addLocalDays(date, 1)) {
      if (days.length >= MAX_RANGE_DAYS) {
        throw new BadRequestException(
          `Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen`,
        );
      }
      days.push({
        date,
        weekday: weekdayOfLocalDate(date),
        kcal: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
      });
    }
    const byDate = new Map(days.map((day) => [day.date, day]));

    const [entries, targetsRow] = await Promise.all([
      this.prisma.diaryEntry.findMany({
        where: { userId, localDate: { gte: start, lte: end } },
        select: { localDate: true, kcal: true, carbs: true, protein: true, fat: true },
      }) as Promise<EntryRow[]>,
      this.prisma.user.findUnique({
        where: { id: userId },
        select: USER_TARGETS_SELECT,
      }) as Promise<UserTargetsRow | null>,
    ]);

    for (const entry of entries) {
      const day = byDate.get(entry.localDate);
      if (!day) continue;
      day.kcal += entry.kcal;
      day.carbs += entry.carbs;
      day.protein += entry.protein;
      day.fat += entry.fat;
    }

    return { start, end, days, targets: toMacroTargetsDto(targetsRow) };
  }
}
