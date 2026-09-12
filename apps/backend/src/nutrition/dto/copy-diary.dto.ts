import { IsString, IsNotEmpty } from 'class-validator';
import { IsLocalDate } from '../../common/utils/local-date.util';

/**
 * "Von einem anderen Tag kopieren" (#151): duplicates a previous day's entries onto the
 * current day. Copied entries are fresh snapshots of the source entries -- same names,
 * quantities and kcal/macros (ADR-0002) -- so a copy never re-reads the current Food values.
 */

/** Copy every entry of `fromDate` onto `toDate`, keeping each entry in its own Abschnitt. */
export class CopyDiaryDayDto {
  @IsLocalDate()
  fromDate: string;

  @IsLocalDate()
  toDate: string;
}

/** Copy just one Abschnitt's entries from `fromDate` into the same Abschnitt on `toDate`. */
export class CopyDiarySlotDto {
  @IsLocalDate()
  fromDate: string;

  @IsLocalDate()
  toDate: string;

  @IsString()
  @IsNotEmpty()
  mealSlotId: string;
}

/** The calendar days that have at least one entry -- the date picker only offers these. */
export class CopySourceDatesDto {
  dates: string[];
}
