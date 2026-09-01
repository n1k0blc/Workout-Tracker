import { SetType } from '../../../generated/prisma/client';

/** Which step of the gym cascade the last performance was found on (issue #112). */
export type LastPerformanceSource = 'CURRENT_GYM' | 'HOME_GYM' | 'ANY_GYM';

export class LastPerformanceSetDto {
  setType: SetType;
  reps: number;
  weight: number;
  rir?: number;
  repsLeft?: number;
  repsRight?: number;
  weightLeft?: number;
  weightRight?: number;
  rirLeft?: number;
  rirRight?: number;
}

/**
 * The last time the user actually performed an exercise, resolved through the gym cascade:
 *
 *   1. the gym passed in (`gymId`)           -> CURRENT_GYM
 *   2. any home gym, most recent             -> HOME_GYM
 *   3. any workout at all, incl. "Anderes Gym" -> ANY_GYM
 *   4. nothing                               -> null
 *
 * The most recent qualifying workout wins -- never the best. `rest` is deliberately omitted:
 * in a performed workout it is *measured* rest and carries noise, so the caller keeps the
 * plan slot's rest (or the 90 s default) instead.
 */
export class LastPerformanceDto {
  exerciseId: string;
  source: LastPerformanceSource;
  /** The `localDate` (YYYY-MM-DD) of the workout the values came from. */
  performedOn: string;
  gymId: string | null;
  /** `null` when that workout was logged at "Anderes Gym". */
  gymName: string | null;
  sets: LastPerformanceSetDto[];
}
