import { MacroTotals } from '@/types';
import { formatKcal } from '@/lib/nutrition';

function MacroCell({ label, grams }: { label: string; grams: number }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-[13px] font-semibold">{Math.round(grams)} g</div>
    </div>
  );
}

/**
 * The "Gegessen" summary for the day. Plain totals only -- the consumed-vs-target state
 * ("Übrig", progress bars) arrives with daily targets in #152.
 */
export function NutritionTotalsCard({ totals }: { totals: MacroTotals }) {
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
        <MacroCell label="Kohlenh." grams={totals.carbs} />
        <MacroCell label="Protein" grams={totals.protein} />
        <MacroCell label="Fett" grams={totals.fat} />
      </div>
    </div>
  );
}
