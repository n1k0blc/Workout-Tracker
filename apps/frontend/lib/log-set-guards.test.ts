import { describe, it, expect } from 'vitest';
import { canLogAdditionalSet } from './log-set-guards';
import { Equipment } from '@/types';

describe('canLogAdditionalSet', () => {
  it('allows a bodyweight set at 0 kg with non-zero reps', () => {
    expect(
      canLogAdditionalSet({ weight: 0, reps: 8, equipment: Equipment.BODYWEIGHT }),
    ).toBe(true);
  });

  it('refuses 0 reps even for a bodyweight exercise', () => {
    expect(
      canLogAdditionalSet({ weight: 0, reps: 0, equipment: Equipment.BODYWEIGHT }),
    ).toBe(false);
  });

  it('refuses 0 kg on a non-bodyweight exercise', () => {
    expect(
      canLogAdditionalSet({ weight: 0, reps: 8, equipment: Equipment.BARBELL }),
    ).toBe(false);
  });

  it('refuses 0 kg when the equipment is unknown', () => {
    expect(canLogAdditionalSet({ weight: 0, reps: 8 })).toBe(false);
  });

  it('allows a normal loaded set', () => {
    expect(
      canLogAdditionalSet({ weight: 60, reps: 10, equipment: Equipment.BARBELL }),
    ).toBe(true);
  });

  it('allows a loaded bodyweight set (weighted pull-up)', () => {
    expect(
      canLogAdditionalSet({ weight: 20, reps: 6, equipment: Equipment.BODYWEIGHT }),
    ).toBe(true);
  });

  it('refuses NaN weight or reps', () => {
    expect(
      canLogAdditionalSet({ weight: NaN, reps: 8, equipment: Equipment.BARBELL }),
    ).toBe(false);
    expect(
      canLogAdditionalSet({ weight: 60, reps: NaN, equipment: Equipment.BARBELL }),
    ).toBe(false);
  });

  it('refuses a negative bodyweight load', () => {
    expect(
      canLogAdditionalSet({ weight: -5, reps: 8, equipment: Equipment.BODYWEIGHT }),
    ).toBe(false);
  });
});
