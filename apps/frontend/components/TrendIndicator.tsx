'use client';

import React from 'react';
import { useFormatter } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface TrendIndicatorProps {
  change: number;
  className?: string;
}

export default function TrendIndicator({ change, className = '' }: TrendIndicatorProps) {
  const format = useFormatter();
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const formattedChange = format.number(Math.abs(change), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  if (isNeutral) {
    return (
      <Badge variant="outline" className={className}>
        0%
      </Badge>
    );
  }

  const Icon = isPositive ? IconTrendingUp : IconTrendingDown;

  return (
    <Badge
      variant={isPositive ? 'default' : 'destructive'}
      className={className}
    >
      <Icon className="mr-1 size-3.5" />
      {isPositive ? '+' : '-'}
      {formattedChange}%
    </Badge>
  );
}
