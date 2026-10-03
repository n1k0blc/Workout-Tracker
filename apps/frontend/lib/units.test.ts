import { describe, it, expect } from 'vitest';
import {
  KG_PER_LB,
  displayWeight,
  weightInputString,
  weightToKg,
  weightUnitLabel,
  displayVolume,
  volumeAnalyticsForDisplay,
  heightUnitLabel,
  heightInputString,
  heightToCm,
} from './units';

describe('weight units (#186)', () => {
  it('labels each system', () => {
    expect(weightUnitLabel('METRIC')).toBe('kg');
    expect(weightUnitLabel('IMPERIAL')).toBe('lb');
  });

  it('displays metric weights rounded to 0.5 kg', () => {
    expect(displayWeight(100, 'METRIC')).toBe(100);
    expect(displayWeight(22.3, 'METRIC')).toBe(22.5);
    expect(displayWeight(22.2, 'METRIC')).toBe(22);
  });

  it('displays imperial weights rounded to 1 lb', () => {
    expect(displayWeight(100, 'IMPERIAL')).toBe(220);
    expect(displayWeight(102.05828325, 'IMPERIAL')).toBe(225);
  });

  it('logging 225 lb and re-reading it in lb returns exactly 225', () => {
    const kg = weightToKg('225', 'IMPERIAL');
    expect(kg).toBeCloseTo(225 * KG_PER_LB, 10);
    expect(displayWeight(kg!, 'IMPERIAL')).toBe(225);
    expect(weightInputString(kg!, 'IMPERIAL')).toBe('225');
  });

  it('treats a typed number as exact in its own unit and converts once', () => {
    expect(weightToKg('62.5', 'METRIC')).toBe(62.5);
    expect(weightToKg('132.5', 'IMPERIAL')).toBeCloseTo(132.5 * KG_PER_LB, 10);
  });

  it('never writes back a value the user did not type', () => {
    const original = 100; // kg; shown as 220 lb, which is not exactly 100 kg
    const shown = weightInputString(original, 'IMPERIAL');
    expect(weightToKg(shown, 'IMPERIAL', original)).toBe(original);
  });

  it('does not accumulate drift across repeated untouched round trips', () => {
    let kg = 100;
    for (let i = 0; i < 5; i++) {
      kg = weightToKg(weightInputString(kg, 'IMPERIAL'), 'IMPERIAL', kg)!;
    }
    expect(kg).toBe(100);
  });

  it('converts an edited value even when an original exists', () => {
    expect(weightToKg('225', 'IMPERIAL', 100)).toBeCloseTo(225 * KG_PER_LB, 10);
  });

  it('returns null for empty or unparseable input', () => {
    expect(weightToKg('', 'METRIC')).toBeNull();
    expect(weightToKg('abc', 'IMPERIAL')).toBeNull();
  });

  it('renders an integer without a trailing .0 and a half kilo with one decimal', () => {
    expect(weightInputString(80, 'METRIC')).toBe('80');
    expect(weightInputString(82.5, 'METRIC')).toBe('82.5');
  });

  it('displays volume in whole units of the chosen system', () => {
    expect(displayVolume(1000, 'METRIC')).toBe(1000);
    expect(displayVolume(1000, 'IMPERIAL')).toBe(2205);
  });
});

describe('height input conversion (#186)', () => {
  it('labels each system', () => {
    expect(heightUnitLabel('METRIC')).toBe('cm');
    expect(heightUnitLabel('IMPERIAL')).toBe('in');
  });

  it('shows whole inches for imperial and cm for metric', () => {
    expect(heightInputString(180, 'IMPERIAL')).toBe('71');
    expect(heightInputString(180, 'METRIC')).toBe('180');
  });

  it('converts typed inches to whole centimetres', () => {
    expect(heightToCm('71', 'IMPERIAL')).toBe(180);
  });

  it('keeps the stored cm when the input is untouched', () => {
    expect(heightToCm(heightInputString(182, 'IMPERIAL'), 'IMPERIAL', 182)).toBe(182);
  });

  it('returns null for empty input', () => {
    expect(heightToCm('', 'METRIC')).toBeNull();
  });
});

describe('volumeAnalyticsForDisplay (#186)', () => {
  const data = {
    totalVolume: 1000,
    dataPoints: [{ date: 'd', volume: 500 }],
    byMuscleGroup: [{ muscleGroup: 'CHEST', volume: 100 }],
  };

  it('converts total, series and muscle-group volume to lb', () => {
    const out = volumeAnalyticsForDisplay(data, 'IMPERIAL');
    expect(out.totalVolume).toBe(2205);
    expect(out.dataPoints[0]).toEqual({ date: 'd', volume: 1102 });
    expect(out.byMuscleGroup![0].volume).toBe(220);
  });

  it('leaves the source object untouched', () => {
    volumeAnalyticsForDisplay(data, 'IMPERIAL');
    expect(data.totalVolume).toBe(1000);
  });
});
