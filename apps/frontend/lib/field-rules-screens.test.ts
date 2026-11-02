import { describe, it, expect } from 'vitest';
import {
  bodyLimits,
  checkAmountText,
  checkBodyWeight,
  checkDateRange,
  checkEan,
  checkHeight,
  checkMacroSum,
  checkStartDate,
  checkWorkoutDate,
} from './field-rules';

/** The rules the per-screen validation ticket (#230) adds on top of the shared ones. */

describe('height and body weight in the unit the user types', () => {
  it('keeps metric height at 100-250 cm, whole numbers', () => {
    expect(checkHeight('', 'METRIC')).toBe('isNotEmpty');
    expect(checkHeight('99', 'METRIC')).toBe('min');
    expect(checkHeight('100', 'METRIC')).toBeNull();
    expect(checkHeight('250', 'METRIC')).toBeNull();
    expect(checkHeight('251', 'METRIC')).toBe('max');
    expect(checkHeight('180.5', 'METRIC')).toBe('isInt');
  });

  it('keeps imperial height at whole inches that convert into 100-250 cm', () => {
    expect(checkHeight('39', 'IMPERIAL')).toBe('min'); // 99 cm
    expect(checkHeight('40', 'IMPERIAL')).toBeNull(); // 102 cm
    expect(checkHeight('98', 'IMPERIAL')).toBeNull(); // 249 cm
    expect(checkHeight('99', 'IMPERIAL')).toBe('max'); // 251 cm
    expect(checkHeight('70.5', 'IMPERIAL')).toBe('isInt');
  });

  it('lets an untouched stored height through even when its rounded display is off the edge', () => {
    // 100 cm displays as 39 in, which on its own would be too small.
    expect(checkHeight('39', 'IMPERIAL', 100)).toBeNull();
  });

  it('keeps metric body weight at 30-400 kg with one decimal', () => {
    expect(checkBodyWeight('29.9', 'METRIC')).toBe('min');
    expect(checkBodyWeight('30', 'METRIC')).toBeNull();
    expect(checkBodyWeight('400', 'METRIC')).toBeNull();
    expect(checkBodyWeight('400.1', 'METRIC')).toBe('max');
    expect(checkBodyWeight('75.55', 'METRIC')).toBe('maxDecimals');
    expect(checkBodyWeight('', 'METRIC')).toBe('isNotEmpty');
  });

  it('keeps imperial body weight at pounds that convert into 30-400 kg, one decimal as typed', () => {
    expect(checkBodyWeight('66.1', 'IMPERIAL')).toBe('min'); // 29.98 kg
    expect(checkBodyWeight('66.2', 'IMPERIAL')).toBeNull(); // 30.03 kg
    expect(checkBodyWeight('881.8', 'IMPERIAL')).toBeNull(); // 399.97 kg
    expect(checkBodyWeight('881.9', 'IMPERIAL')).toBe('max'); // 400.01 kg
    expect(checkBodyWeight('150.25', 'IMPERIAL')).toBe('maxDecimals');
  });

  it('lets an untouched stored weight through unjudged on its decimals', () => {
    expect(checkBodyWeight('66.1', 'IMPERIAL', 30)).toBeNull(); // 30 kg shown as 66.1 lb
  });

  it('states the limits in the typed unit', () => {
    expect(bodyLimits('METRIC')).toEqual({
      height: { min: 100, max: 250, unit: 'cm' },
      weight: { min: 30, max: 400, unit: 'kg' },
    });
    expect(bodyLimits('IMPERIAL')).toEqual({
      height: { min: 40, max: 98, unit: 'in' },
      weight: { min: 66.2, max: 881.8, unit: 'lb' },
    });
  });
});

describe('date rules', () => {
  const today = '2026-11-02';

  it('keeps a Zyklus start date between today and one year ahead', () => {
    expect(checkStartDate('', today)).toBe('isNotEmpty');
    expect(checkStartDate('2026-11-01', today)).toBe('minDate');
    expect(checkStartDate('2026-11-02', today)).toBeNull();
    expect(checkStartDate('2027-11-02', today)).toBeNull();
    expect(checkStartDate('2027-11-03', today)).toBe('maxDate');
  });

  it('measures a leap day to 28 February', () => {
    expect(checkStartDate('2029-02-28', '2028-02-29')).toBeNull();
    expect(checkStartDate('2029-03-01', '2028-02-29')).toBe('maxDate');
  });

  it('keeps a past workout between 2000-01-01 and today', () => {
    expect(checkWorkoutDate('', today)).toBe('isNotEmpty');
    expect(checkWorkoutDate('1999-12-31', today)).toBe('minDate');
    expect(checkWorkoutDate('2000-01-01', today)).toBeNull();
    expect(checkWorkoutDate('2026-11-02', today)).toBeNull();
    expect(checkWorkoutDate('2026-11-03', today)).toBe('maxDate');
  });

  it('wants a range to start on or before its end', () => {
    expect(checkDateRange('2026-10-01', '2026-10-01')).toBeNull();
    expect(checkDateRange('2026-10-01', '2026-10-02')).toBeNull();
    expect(checkDateRange('2026-10-02', '2026-10-01')).toBe('endBeforeStart');
    expect(checkDateRange('', '2026-10-01')).toBeNull(); // an unfinished range is not wrong yet
  });
});

describe('nutrition amounts typed as text', () => {
  it('reads a decimal comma like a period', () => {
    expect(checkAmountText('371,5', 0, 900, 1)).toBeNull();
    expect(checkAmountText('371,55', 0, 900, 1)).toBe('maxDecimals');
  });

  it('judges the range at its edges', () => {
    expect(checkAmountText('0', 0, 900, 1)).toBeNull();
    expect(checkAmountText('-0,1', 0, 900, 1)).toBe('min');
    expect(checkAmountText('900', 0, 900, 1)).toBeNull();
    expect(checkAmountText('900,1', 0, 900, 1)).toBe('max');
    expect(checkAmountText('0,09', 0.1, 5000)).toBe('min');
    expect(checkAmountText('0,1', 0.1, 5000)).toBeNull();
    expect(checkAmountText('5000', 0.1, 5000)).toBeNull();
    expect(checkAmountText('5000,1', 0.1, 5000)).toBe('max');
  });

  it('names a blank and a non-number', () => {
    expect(checkAmountText('  ', 0, 900)).toBe('isNotEmpty');
    expect(checkAmountText('abc', 0, 900)).toBe('isNumber');
    expect(checkAmountText('1.2.3', 0, 900)).toBe('isNumber');
  });
});

describe('macro sum and EAN', () => {
  it('allows carbs, protein and fat to total 100 g, not a tenth more', () => {
    expect(checkMacroSum(['50', '30', '20'])).toBeNull();
    expect(checkMacroSum(['33.3', '33.3', '33.4'])).toBeNull();
    expect(checkMacroSum(['50', '30', '20.1'])).toBe('macroSum');
    expect(checkMacroSum(['', 'x', '20'])).toBeNull(); // judged only when all three are numbers
  });

  it('applies the scanner rule to the editor: 8, 12 or 13 digits with a valid check digit', () => {
    expect(checkEan('4006381333931')).toBeNull();
    expect(checkEan('73513537')).toBeNull();
    expect(checkEan('036000291452')).toBeNull();
    expect(checkEan('4006381333932')).toBe('isBarcode'); // check digit off by one
    expect(checkEan('7351353')).toBe('isBarcode');
    expect(checkEan('40063813339310')).toBe('isBarcode');
    expect(checkEan('4006 3813 33931')).toBeNull(); // spaces are tolerated like in the scanner
  });
});
