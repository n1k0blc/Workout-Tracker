'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toLocalDateString } from '@/lib/local-date';

interface DatePickerProps {
  date: Date | null;
  onSelect: (date: Date | null) => void;
  placeholder?: string;
  /** Earliest pickable day, `YYYY-MM-DD`. */
  min?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Set by `useFormErrors().fieldProps`; the field turns red and is found by focus-first-invalid. */
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function DatePicker({
  date,
  onSelect,
  placeholder,
  min,
  disabled = false,
  className,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const t = useTranslations('DatePicker');
  // Convert Date to YYYY-MM-DD for native input
  const inputValue = date ? date.toISOString().split('T')[0] : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      onSelect(new Date(value));
    } else {
      onSelect(null);
    }
  };

  return (
    <input
      id={id}
      type="date"
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      value={inputValue}
      onChange={handleChange}
      disabled={disabled}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive ${className || ''}`}
      placeholder={placeholder ?? t('placeholder')}
      min={min}
      max={toLocalDateString(new Date())}
    />
  );
}
