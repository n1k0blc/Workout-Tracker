import { MacroTargets, MacroTotals } from '@/types';
import {
  formatKcal,
  remainingToTarget,
  targetProgressPercent,
} from '@/lib/nutrition';
import { MacroProgressBar } from '@/components/nutrition/macro-progress-bar';

function PlainMacroCell({ label, grams }: { label: string; grams: number }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-[13px] font-semibold">{Math.round(grams)} g</div>
    </div>
  );
}

function TargetMacroCell({
  label,
  grams,
  target,
}: {
  label: string;
  grams: number;
  target: number | null;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <MacroProgressBar percent={targetProgressPercent(grams, target)} className="mt-2" />
      <div className="mt-2 text-[13px] font-semibold">
        {Math.round(grams)}
        <span className="font-normal text-muted-foreground">
          {' '}
          {target !== null ? `/ ${Math.round(target)} g` : 'g'}
        </span>
      </div>
    </div>
  );
}

/**
 * The "Gegessen" summary for the day. Without Tagesziele it shows plain totals; once the user
 * has set at least one target (#152) it switches to the consumed-vs-target state with "Übrig"
 * and thin progress bars for kcal and each macro that has a target.
 */
export function NutritionTotalsCard({
  totals,
  targets,
}: {
  totals: MacroTotals;
  targets?: MacroTargets | null;
}) {
  if (!targets) {
    return (
      <div className="border bg-card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Gegessen
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[34px] font-bold leading-none">{formatKcal(totals.kcal)}</span>
          <span className="text-sm text-muted-foreground">kcal</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <PlainMacroCell label="Kohlenh." grams={totals.carbs} />
          <PlainMacroCell label="Protein" grams={totals.protein} />
          <PlainMacroCell label="Fett" grams={totals.fat} />
        </div>
      </div>
    );
  }

  const remaining = remainingToTarget(totals.kcal, targets.kcal);

  return (
    <div className="border bg-card p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Gegessen
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[34px] font-bold leading-none">
              {formatKcal(totals.kcal)}
            </span>
            <span className="text-sm text-muted-foreground">
              {targets.kcal !== null ? `/ ${formatKcal(targets.kcal)} kcal` : 'kcal'}
            </span>
          </div>
        </div>
        {remaining !== null && (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Übrig
            </div>
            <div className="mt-1.5 text-lg font-semibold">{formatKcal(remaining)}</div>
          </div>
        )}
      </div>

      <MacroProgressBar
        percent={targetProgressPercent(totals.kcal, targets.kcal)}
        className="mt-2"
      />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <TargetMacroCell label="Kohlenh." grams={totals.carbs} target={targets.carbs} />
        <TargetMacroCell label="Protein" grams={totals.protein} target={targets.protein} />
        <TargetMacroCell label="Fett" grams={totals.fat} target={targets.fat} />
      </div>
    </div>
  );
}
