'use client';

import { ReactNode, useEffect, useState } from 'react';

interface ScrollableChartProps {
  children: ReactNode;
  dataPointCount: number;
  minDataPointsForScroll?: number; // ab wann horizontal scrollen aktiviert wird
}

/**
 * Wrapper-Komponente für Charts, die auf Mobile horizontal scrollbar macht
 * wenn zu viele Datenpunkte vorhanden sind.
 * 
 * @param dataPointCount - Anzahl der Datenpunkte im Chart
 * @param minDataPointsForScroll - Ab wie vielen Datenpunkten scrollen aktiviert wird (default: 5)
 */
export default function ScrollableChart({ 
  children, 
  dataPointCount,
  minDataPointsForScroll = 5 
}: ScrollableChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const shouldScroll = isMobile && dataPointCount > minDataPointsForScroll;
  
  // Berechne Breite basierend auf Anzahl der Datenpunkte
  // ~60px pro Datenpunkt für gute Lesbarkeit auf Mobile
  const chartWidth = shouldScroll ? dataPointCount * 60 : undefined;

  console.log('ScrollableChart Debug:', { 
    isMobile, 
    dataPointCount, 
    minDataPointsForScroll,
    shouldScroll, 
    chartWidth,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'SSR'
  });

  return (
    <div className={shouldScroll ? 'overflow-x-auto pb-2' : ''}>
      <div style={{ width: chartWidth }}>
        {children}
      </div>
    </div>
  );
}
