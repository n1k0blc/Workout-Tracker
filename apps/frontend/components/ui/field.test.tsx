// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FieldError, FieldWarning } from './field';

afterEach(cleanup);

describe('FieldError', () => {
  it('shows its message in red as an alert', () => {
    render(<FieldError id="email-error">Please enter a valid email address.</FieldError>);

    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Please enter a valid email address.');
    expect(error.id).toBe('email-error');
    expect(error.className).toContain('text-destructive');
  });

  it('renders nothing without a message', () => {
    const { container } = render(<FieldError id="x">{undefined}</FieldError>);

    expect(container.innerHTML).toBe('');
  });
});

describe('FieldWarning', () => {
  it('shows its hint in amber and does not announce itself as an error', () => {
    render(<FieldWarning id="rir-warning">Aim for at most RIR 2.</FieldWarning>);

    const warning = screen.getByText('Aim for at most RIR 2.');
    expect(warning.id).toBe('rir-warning');
    expect(warning.className).toContain('text-amber');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing without a message', () => {
    const { container } = render(<FieldWarning id="x">{null}</FieldWarning>);

    expect(container.innerHTML).toBe('');
  });
});
