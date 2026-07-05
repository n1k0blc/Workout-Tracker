'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface ScrollableChartProps {
  children: ReactNode;
  dataPointCount: number;
  minDataPointsForScroll?: number; // ab wann horizontal scrollen aktiviert wird
}

/**
 * Wrapper-Komponente für Charts, die horizontal scrollbar macht, wenn zu viele
 * Datenpunkte vorhanden sind (Desktop und Mobile gleichermaßen).
 *
 * @param dataPointCount - Anzahl der Datenpunkte im Chart
 * @param minDataPointsForScroll - Ab wie vielen Datenpunkten scrollen aktiviert wird (default: 5)
 */
export default function ScrollableChart({
  children,
  dataPointCount,
  minDataPointsForScroll = 5
}: ScrollableChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shouldScroll = dataPointCount > minDataPointsForScroll;

  // ~60px pro Datenpunkt für gute Lesbarkeit; nie schmaler als die verfügbare Breite,
  // damit der Chart auf großen Bildschirmen nicht unnötig schrumpft.
  const chartWidth = shouldScroll ? Math.max(dataPointCount * 60, containerWidth) : undefined;

  return (
    <div ref={containerRef} className={shouldScroll ? 'overflow-x-auto pb-2' : ''}>
      <div style={{ width: chartWidth }}>
        {children}
      </div>
    </div>
  );
}
