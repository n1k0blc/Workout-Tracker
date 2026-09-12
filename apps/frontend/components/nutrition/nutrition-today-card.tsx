import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import { MacroTargets, MacroTotals } from '@/types';
import {
  formatKcal,
  formatMacroLineLong,
  remainingToTarget,
  targetProgressPercent,
} from '@/lib/nutrition';
import { Card, CardContent } from '@/components/ui/card';
import { MacroProgressBar } from '@/components/nutrition/macro-progress-bar';

/**
 * The dashboard's "Ernährung heute" card (#152): today's kcal against the target, a thin
 * progress bar, the macro line and what is left. The dashboard only renders this once the
 * user has set at least one Tagesziel, so `targets` is always non-null here.
 */
export function NutritionTodayCard({
  totals,
  targets,
}: {
  totals: MacroTotals;
  targets: MacroTargets;
}) {
  const remaining = remainingToTarget(totals.kcal, targets.kcal);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium text-muted-foreground">Ernährung heute</div>
          <Link
            href="/nutrition"
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:underline"
          >
            Details
            <IconChevronRight className="size-3" />
          </Link>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-3xl font-bold leading-none">{formatKcal(totals.kcal)}</span>
          <span className="text-sm text-muted-foreground">
            {targets.kcal !== null ? `/ ${formatKcal(targets.kcal)} kcal` : 'kcal'}
          </span>
        </div>
        <MacroProgressBar
          percent={targetProgressPercent(totals.kcal, targets.kcal)}
          className="mt-4"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{formatMacroLineLong(totals)}</div>
          {remaining !== null && (
            <div className="shrink-0 text-xs font-semibold">
              {formatKcal(remaining)} übrig
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
