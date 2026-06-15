'use client';

import React from 'react';

interface TrendIndicatorProps {
  change: number;
  className?: string;
}

export default function TrendIndicator({ change, className = '' }: TrendIndicatorProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const formattedChange = Math.abs(change).toFixed(1);

  if (isNeutral) {
    return (
      <div className={`flex items-center gap-1 text-sm text-gray-500 ${className}`}>
        <span>→</span>
        <span>0%</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium ${className} ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}
    >
      <span className="text-lg leading-none">
        {isPositive ? '↗' : '↘'}
      </span>
      <span>
        {isPositive ? '+' : '-'}
        {formattedChange}%
      </span>
    </div>
  );
}
