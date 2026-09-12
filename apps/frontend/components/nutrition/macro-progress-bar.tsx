import { cn } from '@/lib/utils';

/**
 * The 2 px consumed-vs-target track shared by the nutrition screens (Tagesansicht totals,
 * dashboard card, Tagesziele footer). A `null` percent renders an empty track — the caller
 * has no target to draw against.
 */
export function MacroProgressBar({
  percent,
  className,
}: {
  percent: number | null;
  className?: string;
}) {
  return (
    <div className={cn('h-0.5 bg-muted', className)}>
      {percent !== null && (
        <div className="h-0.5 bg-foreground" style={{ width: `${percent}%` }} />
      )}
    </div>
  );
}
