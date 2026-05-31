'use client';

import * as React from 'react';

interface DatePickerProps {
  date: Date | null;
  onSelect: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = 'TT.MM.JJJJ',
  disabled = false,
  className,
}: DatePickerProps) {
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
      type="date"
      value={inputValue}
      onChange={handleChange}
      disabled={disabled}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      placeholder={placeholder}
      max={new Date().toISOString().split('T')[0]}
    />
  );
}
