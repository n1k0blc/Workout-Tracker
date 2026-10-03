// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { Equipment, MuscleGroup } from '@/types';
import { useExerciseLabels } from './useExerciseLabels';
import deMessages from '@/messages/de.json';
import enMessages from '@/messages/en.json';

function wrapperFor(locale: 'de' | 'en') {
  const messages = locale === 'de' ? deMessages : enMessages;
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

describe('useExerciseLabels', () => {
  it('resolves every MuscleGroup and Equipment label in German', () => {
    const { result } = renderHook(() => useExerciseLabels(), { wrapper: wrapperFor('de') });

    expect(result.current.translateMuscleGroup(MuscleGroup.LOWER_BACK)).toBe('Unterer Rücken');
    expect(result.current.translateMuscleGroup(MuscleGroup.TRICEPS)).toBe('Trizeps');
    expect(result.current.translateEquipment(Equipment.EZ_BAR)).toBe('SZ-Stange');
    expect(result.current.translateEquipment(Equipment.SMITH_MACHINE)).toBe('Smith-Maschine');
  });

  it('resolves every MuscleGroup and Equipment label in English', () => {
    const { result } = renderHook(() => useExerciseLabels(), { wrapper: wrapperFor('en') });

    expect(result.current.translateMuscleGroup(MuscleGroup.LOWER_BACK)).toBe('Lower Back');
    expect(result.current.translateMuscleGroup(MuscleGroup.TRICEPS)).toBe('Triceps');
    expect(result.current.translateEquipment(Equipment.EZ_BAR)).toBe('EZ Bar');
    expect(result.current.translateEquipment(Equipment.SMITH_MACHINE)).toBe('Smith Machine');
  });

  it('falls back to the raw value for an unrecognized key instead of throwing', () => {
    const { result } = renderHook(() => useExerciseLabels(), { wrapper: wrapperFor('de') });

    expect(result.current.translateMuscleGroup('LEGACY_BACK')).toBe('LEGACY_BACK');
    expect(result.current.translateEquipment('RESISTANCE_BAND')).toBe('RESISTANCE_BAND');
  });

  it('has a catalogue entry for every enum member, in both locales', () => {
    // A missing key falls back to the raw enum constant unchanged (see the previous test),
    // so the fallback itself can't be used to detect a missing entry. Every real label does
    // differ in case from its SCREAMING_CASE enum key, so asserting inequality here is what
    // actually distinguishes "translated" from "silently fell back".
    for (const wrapper of [wrapperFor('de'), wrapperFor('en')]) {
      const { result } = renderHook(() => useExerciseLabels(), { wrapper });

      for (const muscleGroup of Object.values(MuscleGroup)) {
        expect(result.current.translateMuscleGroup(muscleGroup)).not.toBe(muscleGroup);
      }
      for (const equipment of Object.values(Equipment)) {
        expect(result.current.translateEquipment(equipment)).not.toBe(equipment);
      }
    }
  });
});
