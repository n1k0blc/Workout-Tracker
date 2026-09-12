import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { IsLocalDate } from '../../common/utils/local-date.util';

/**
 * Logs a Mahlzeit into an Abschnitt (#147). The service resolves the meal, scales every
 * ingredient by `quantity * factor / 100` from the food's *current* per-100 values, and
 * writes one snapshotted DiaryEntry per ingredient, each carrying `mealId` as a grouping
 * tag. `factor` is the picker's Faktor control (0.5 / 1 / 1.5 / 2 in the UI; any positive
 * number is accepted).
 */
export class CreateDiaryEntriesFromMealDto {
  @IsString()
  @IsNotEmpty()
  mealSlotId: string;

  @IsLocalDate()
  localDate: string;

  @IsString()
  @IsNotEmpty()
  mealId: string;

  @IsNumber()
  @IsPositive()
  factor: number;
}
