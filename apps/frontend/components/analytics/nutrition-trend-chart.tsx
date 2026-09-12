'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import ScrollableChart from './scrollable-chart';
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from './chart-styles';
import { fromLocalDateString } from '@/lib/local-date';
import {
  NUTRITION_METRICS,
  metricTarget,
  formatMetricValue,
  formatKcal,
  nutritionDailyAverage,
  nutritionTargetReached,
} from '@/lib/nutrition';
import type { NutritionMetric, NutritionTrend } from '@/types';

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** A `YYYY-MM-DD` day as `"07.09."` for the tooltip header -- read as a local day, not UTC. */
function formatDayLabel(localDate: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(
    fromLocalDateString(localDate),
  );
}

interface NutritionTrendChartProps {
  trend: NutritionTrend | null;
  /** The legend line's range phrase, e.g. `"letzte 7 Tage"` or a cycle's own `"DD.MM. - DD.MM."`
   *  span in Zyklus-Modus -- the caller decides which, since it knows the mode. */
  rangeLabel: string;
  loading?: boolean;
}

/**
 * Ernährungs-Analytics v1 (#153, design screen 11): daily totals over the analytics range
 * selector -- or, in Zyklus-Modus, the selected cycle's own span -- a metric toggle (kcal /
 * KH / Protein / Fett), a dashed "ZIEL" reference line when the selected metric has a
 * Tagesziel, and the "Ø pro Tag" / "Ziel erreicht" stat tiles. Days with no entries come back
 * as zeros, so the line is continuous.
 */
export default function NutritionTrendChart({
  trend,
  rangeLabel,
  loading = false,
}: NutritionTrendChartProps) {
  const [metric, setMetric] = useState<NutritionMetric>('kcal');
  const metricConfig = NUTRITION_METRICS.find((m) => m.key === metric)!;

  const days = trend?.days ?? [];
  const rawTarget = metricTarget(trend?.targets ?? null, metric);
  // One notion of "has a target" for both the reference line and the "Ziel erreicht" tile.
  const target = rawTarget !== null && rawTarget > 0 ? rawTarget : null;
  const average = nutritionDailyAverage(days, metric);
  const reached = nutritionTargetReached(days, metric, target);

  const yTickFormatter = (value: number) =>
    metric === 'kcal' ? formatKcal(value) : String(Math.round(value));

  // recharts hands the tick formatter the index among *rendered* ticks, not the data row, so
  // look the weekday up by the tick's date value.
  const weekdayByDate = new Map(days.map((d) => [d.date, d.weekday]));
  const xTickFormatter = (value: string) =>
    WEEKDAY_SHORT[weekdayByDate.get(value) ?? 0] ?? '';

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Ernährung</h3>

        <div className="mb-5 flex w-fit border border-border">
          {NUTRITION_METRICS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={m.key === metric}
              className={`h-9 px-3.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                i > 0 ? 'border-l border-border' : ''
              } ${
                m.key === metric
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Lädt Ernährungsdaten…</div>
        ) : days.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Noch keine Ernährungsdaten für den ausgewählten Zeitraum.
          </div>
        ) : (
          <>
            <ScrollableChart dataPointCount={days.length}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={days} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={xTickFormatter}
                    interval="preserveStartEnd"
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis
                    width={48}
                    tickFormatter={yTickFormatter}
                    domain={['auto', 'auto']}
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value) => [formatMetricValue(value as number, metric), metricConfig.label]}
                    labelFormatter={(label) => formatDayLabel(label as string)}
                  />
                  {target !== null && (
                    <ReferenceLine
                      y={target}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="6 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `ZIEL ${formatMetricValue(target, metric)}`,
                        position: 'insideTopRight',
                        fill: 'var(--muted-foreground)',
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ScrollableChart>

            <div className="mt-4 flex items-center gap-2">
              <span className="h-0.5 w-3.5 flex-none bg-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {metricConfig.label} pro Tag · {rangeLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <div className="text-[11px] text-muted-foreground">Ø pro Tag</div>
                <div className="mt-1 text-[17px] font-semibold text-foreground">
                  {formatMetricValue(average, metric)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Ziel erreicht</div>
                <div className="mt-1 text-[17px] font-semibold text-foreground">
                  {reached ? `${reached.hit} von ${reached.total} Tagen` : 'Kein Ziel gesetzt'}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
