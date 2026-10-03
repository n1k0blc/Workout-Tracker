import { PersonalRecord } from '@/types';

/**
 * The raw numeric value and unit key for a PR, locale-neutral. `PersonalRecordCard` (its only
 * caller) localizes the unit word and rounds/formats the number itself via `useFormatter()`.
 */
export function prValueParts(pr: PersonalRecord): { value: number; unit: 'kg' | 'reps' } {
  switch (pr.type) {
    case 'weight':
      return { value: pr.value, unit: 'kg' };
    case 'reps':
      return { value: pr.value, unit: 'reps' };
    case 'volume':
    case 'one_rm':
      return { value: Math.round(pr.value), unit: 'kg' };
    default:
      return { value: pr.value, unit: 'kg' };
  }
}
