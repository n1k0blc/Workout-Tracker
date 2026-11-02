// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de.json';
import { QuantityStepper } from './quantity-stepper';

afterEach(cleanup);

/** The free amount of a food is 0,1-5000 g (or ml); anything else is a field error, not ignored. */
function renderStepper(isLiquid = false) {
  const onChange = vi.fn();
  const onValidityChange = vi.fn();
  render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <QuantityStepper
        portions={[]}
        isLiquid={isLiquid}
        grams={100}
        portionLabel={null}
        onChange={onChange}
        onValidityChange={onValidityChange}
      />
    </NextIntlClientProvider>,
  );
  const field = screen.getByPlaceholderText('100') as HTMLInputElement;
  return { onChange, onValidityChange, type: (v: string) => fireEvent.change(field, { target: { value: v } }), field };
}

describe('QuantityStepper free amount', () => {
  it.each([
    ['0,1', 0.1],
    ['5000', 5000],
  ])('applies %s', (typed, grams) => {
    const { onChange, onValidityChange, type, field } = renderStepper();
    type(typed);
    expect(onChange).toHaveBeenCalledWith(grams, null);
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(onValidityChange).not.toHaveBeenLastCalledWith(false);
  });

  it.each([
    ['0,09', 'Die Menge muss mindestens 0,1 g betragen.'],
    ['0', 'Die Menge muss mindestens 0,1 g betragen.'],
    ['5000,1', 'Die Menge darf höchstens 5.000 g betragen.'],
    ['abc', 'Bitte gib eine Zahl ein.'],
  ])('refuses %s and does not apply it', (typed, message) => {
    const { onChange, onValidityChange, type, field } = renderStepper();
    type(typed);
    expect(screen.getByText(message)).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('names millilitres for a liquid', () => {
    const { type } = renderStepper(true);
    type('5001');
    expect(screen.getByText('Die Menge darf höchstens 5.000 ml betragen.')).toBeTruthy();
  });

  it('is valid again once the field is cleared', () => {
    const { onValidityChange, type } = renderStepper();
    type('9999');
    type('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});
