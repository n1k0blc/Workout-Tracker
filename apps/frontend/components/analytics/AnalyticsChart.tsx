'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ScrollableChart from './scrollable-chart';
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
  getLineStroke,
} from './chart-styles';
import { formatXAxisLabel, formatTooltipLabel, formatNumber, formatDate } from './chart-utils';

interface AnalyticsChartProps {
  data: any[];
  title: string;
  height?: number;
  chartType?: 'line' | 'bar';
  isComparison?: boolean;
  lineConfigs?: Array<{
    dataKey: string;
    name: string;
    yAxisId?: string;
    unit?: string;
    color?: string;
  }>;
  // For single metric charts
  dataKey?: string;
  name?: string;
  stroke?: string;
  yAxisTickFormatter?: (value: number) => string;
  yAxisLabel?: string;
  // Optional custom formatters
  xTickFormatter?: (value: any, index: number) => string;
  tooltipFormatter?: (value: any, name?: string | number) => [string | number, string | number];
  // Pass through additional Recharts props if needed
  children?: React.ReactNode; // for custom series if needed
  footer?: React.ReactNode; // optional content after the chart (e.g. totals)
}

/**
 * Central reusable chart component for analytics pages.
 * Handles common boilerplate: ScrollableChart, ResponsiveContainer,
 * grid, axes, tooltip (black style), legend, and consistent styling.
 *
 * Usage examples:
 * - Comparison (multi-line): pass isComparison + lineConfigs
 * - Single line: pass dataKey, name, stroke
 * - Bar (e.g. RIR): pass chartType="bar"
 */
export default function AnalyticsChart({
  data,
  title,
  height = 300,
  chartType = 'line',
  isComparison = false,
  lineConfigs,
  dataKey,
  name,
  stroke,
  yAxisTickFormatter,
  yAxisLabel,
  xTickFormatter,
  tooltipFormatter,
  children,
  footer,
}: AnalyticsChartProps) {
  const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
  const SeriesComponent = chartType === 'bar' ? Bar : Line;

  const defaultXTickFormatter = (value: any, index: number) => {
    if (xTickFormatter) return xTickFormatter(value, index);
    const entry = data[index] || {};
    return formatXAxisLabel(entry);
  };

  const defaultTooltipFormatter = (value: any, name?: string | number) => {
    if (tooltipFormatter) return tooltipFormatter(value, name);
    return [`${formatNumber(value as number)}`, String(name || '')];
  };

  const renderSeries = () => {
    if (children) {
      return children;
    }

    if (isComparison && lineConfigs) {
      return lineConfigs.map((config, idx) => (
        <Line
          key={config.dataKey}
          type="monotone"
          dataKey={config.dataKey}
          name={config.name}
          stroke={config.color || getLineStroke(idx)}
          yAxisId={config.yAxisId || 'left'}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          connectNulls={true}
        />
      ));
    }

    // Single series
    if (dataKey) {
      const seriesProps: any = {
        dataKey,
        name: name || dataKey,
        stroke: stroke || 'var(--foreground)',
        strokeWidth: 2,
        dot: { r: chartType === 'bar' ? undefined : 4 },
      };

      if (chartType === 'bar') {
        return <Bar key={dataKey} {...seriesProps} />;
      }
      return <Line key={dataKey} {...seriesProps} />;
    }

    return null;
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <ScrollableChart dataPointCount={data.length}>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={defaultXTickFormatter}
              style={{ fontSize: '12px' }}
            />

            {/* Y-Axis handling - simplified for common cases; can be extended */}
            <YAxis
              yAxisId="left"
              style={{ fontSize: '12px' }}
              tickFormatter={yAxisTickFormatter || ((value) => `${formatNumber(value)}`)}
              label={
                yAxisLabel
                  ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
                  : undefined
              }
            />

            {isComparison && lineConfigs && lineConfigs.some((c) => c.yAxisId === 'right') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                style={{ fontSize: '12px' }}
              />
            )}

            <Tooltip
              contentStyle={tooltipContentStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              formatter={defaultTooltipFormatter}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  return formatTooltipLabel(payload[0].payload);
                }
                return formatDate(label as string);
              }}
            />
            <Legend />

            {renderSeries()}
          </ChartComponent>
        </ResponsiveContainer>
      </ScrollableChart>
      {footer}
    </div>
  );
}
