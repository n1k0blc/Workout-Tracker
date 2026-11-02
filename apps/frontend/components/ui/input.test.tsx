// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Input } from './input';

afterEach(cleanup);

/** Hardened number inputs (#222, ADR-0005): the type stays "number", the foot-guns go. */
describe('Input type="number"', () => {
  it.each(['e', 'E', '+', '-'])('blocks the %s key', (key) => {
    render(<Input type="number" aria-label="n" />);
    const field = screen.getByLabelText('n');

    // fireEvent returns false when the event was default-prevented, i.e. the key never types.
    expect(fireEvent.keyDown(field, { key })).toBe(false);
  });

  it.each(['0', '7', '.', ',', 'Backspace', 'Tab', 'ArrowUp'])('lets %s through', (key) => {
    render(<Input type="number" aria-label="n" />);

    expect(fireEvent.keyDown(screen.getByLabelText('n'), { key })).toBe(true);
  });

  it('still lets a shortcut like Ctrl+E through', () => {
    render(<Input type="number" aria-label="n" />);

    expect(fireEvent.keyDown(screen.getByLabelText('n'), { key: 'e', ctrlKey: true })).toBe(true);
  });

  it('drops focus on wheel so the mouse wheel cannot change the value', () => {
    render(<Input type="number" aria-label="n" defaultValue="5" />);
    const field = screen.getByLabelText('n') as HTMLInputElement;
    field.focus();
    expect(document.activeElement).toBe(field);

    fireEvent.wheel(field, { deltaY: -100 });

    expect(document.activeElement).not.toBe(field);
    expect(field.value).toBe('5');
  });

  it('still calls the caller handlers', () => {
    const onKeyDown = vi.fn();
    const onWheel = vi.fn();
    render(<Input type="number" aria-label="n" onKeyDown={onKeyDown} onWheel={onWheel} />);
    const field = screen.getByLabelText('n');

    fireEvent.keyDown(field, { key: '1' });
    fireEvent.wheel(field);

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onWheel).toHaveBeenCalledTimes(1);
  });

  it('passes min, max and step through to the element', () => {
    render(<Input type="number" aria-label="n" min={100} max={250} step={1} />);
    const field = screen.getByLabelText('n');

    expect(field).toHaveProperty('min', '100');
    expect(field).toHaveProperty('max', '250');
    expect(field).toHaveProperty('step', '1');
  });
});

describe('Input of other types', () => {
  it('does not block e, + or -', () => {
    render(<Input type="text" aria-label="t" />);

    expect(fireEvent.keyDown(screen.getByLabelText('t'), { key: '-' })).toBe(true);
  });
});
