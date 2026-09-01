import { Equipment } from '@/types';

/**
 * Whether an *additional* set -- one the user adds themselves mid-session, as opposed to a
 * planned set -- may be logged with the given weight and reps.
 *
 * Reps must always be non-zero: a set of zero reps is never a set. Weight must be non-zero
 * too, *except* on a `BODYWEIGHT` exercise, where 0 kg is a legitimate load -- dips, pull-ups
 * and push-ups at bodyweight really are 0 kg. A 0 kg barbell bench press stays a mistake worth
 * blocking, so every other equipment keeps the strict guard, as does an unknown equipment.
 */
export function canLogAdditionalSet(input: {
  weight: number;
  reps: number;
  equipment?: Equipment | null;
}): boolean {
  if (!Number.isFinite(input.reps) || input.reps <= 0) return false;

  if (input.equipment === Equipment.BODYWEIGHT) {
    return Number.isFinite(input.weight) && input.weight >= 0;
  }

  return Number.isFinite(input.weight) && input.weight > 0;
}
