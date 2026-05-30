import { PersonalRecord } from '@/types';

export function formatPRType(type: string): string {
  switch (type) {
    case 'weight':
      return 'Gewicht';
    case 'reps':
      return 'Wiederholungen';
    case 'volume':
      return 'Volumen';
    case 'one_rm':
      return '1RM';
    default:
      return type;
  }
}

export function formatPRValue(pr: PersonalRecord): string {
  switch (pr.type) {
    case 'weight':
      return `${pr.value} kg`;
    case 'reps':
      return `${pr.value} Wdh`;
    case 'volume':
      return `${Math.round(pr.value)} kg`;
    case 'one_rm':
      return `${Math.round(pr.value)} kg`;
    default:
      return `${pr.value}`;
  }
}