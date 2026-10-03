// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { KG_PER_LB } from '@/lib/units';

let unitSystem: 'METRIC' | 'IMPERIAL' = 'IMPERIAL';
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { unitSystem } }),
}));

import { WeightInput } from './weight-input';

/** Form state stays canonical kg, exactly like the exercise card's edit buffers. */
function Harness({ initialKg, onKg }: { initialKg: string; onKg: (kg: string) => void }) {
  const [kg, setKg] = useState(initialKg);
  return (
    <WeightInput
      aria-label="w"
      valueKg={kg}
      onChangeKg={(next) => {
        setKg(next);
        onKg(next);
      }}
    />
  );
}

const field = () => screen.getByLabelText('w') as HTMLInputElement;

/** Weight unit system (#186, ADR-0005): display-only conversion over kg form state. */
describe('WeightInput', () => {
  afterEach(() => {
    cleanup();
    unitSystem = 'IMPERIAL';
  });

  it('shows kg form state in lb without writing anything back', () => {
    const onKg = vi.fn();
    render(<Harness initialKg="100" onKg={onKg} />);

    expect(field().value).toBe('220');
    expect(onKg).not.toHaveBeenCalled();
  });

  it('converts a typed number once, treating it as exact in lb', () => {
    const onKg = vi.fn();
    render(<Harness initialKg="" onKg={onKg} />);

    fireEvent.change(field(), { target: { value: '225' } });

    expect(Number(onKg.mock.calls.at(-1)![0])).toBeCloseTo(225 * KG_PER_LB, 10);
    expect(field().value).toBe('225');
  });

  it('re-reads a logged 225 lb as exactly 225', () => {
    render(<Harness initialKg={String(225 * KG_PER_LB)} onKg={vi.fn()} />);

    expect(field().value).toBe('225');
  });

  it('passes a cleared field through as an empty string', () => {
    const onKg = vi.fn();
    render(<Harness initialKg="100" onKg={onKg} />);

    fireEvent.change(field(), { target: { value: '' } });

    expect(onKg).toHaveBeenLastCalledWith('');
    expect(field().value).toBe('');
  });

  it('shows and writes kilograms untouched for metric users', () => {
    unitSystem = 'METRIC';
    const onKg = vi.fn();
    render(<Harness initialKg="82.5" onKg={onKg} />);

    expect(field().value).toBe('82.5');
    fireEvent.change(field(), { target: { value: '85' } });
    expect(onKg).toHaveBeenLastCalledWith('85');
  });
});
