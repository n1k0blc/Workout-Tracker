/**
 * Shared chart styling and helpers for analytics pages (main /analytics and /cycles/[id]).
 * Keeps line colors, tooltips and RIR bars consistent (black/foreground + gray steps, dark-mode safe).
 */

export const getLineStroke = (index: number) => {
  if (index === 0) {
    return 'var(--foreground)';
  }
  return 'var(--muted-foreground)';
};

export const CHART_ACCENT = 'var(--foreground)';

export const tooltipContentStyle = {
  backgroundColor: '#000',
  color: '#fff',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '8px 10px',
};

export const tooltipItemStyle = { color: '#fff' };
export const tooltipLabelStyle = { color: '#fff' };

export const getRIRBarFill = (rirLevel: number) => {
  if (rirLevel === 0) return 'var(--foreground)';
  const graySteps = ['oklch(0.45 0 0)', 'oklch(0.78 0 0)'];
  return graySteps[rirLevel - 1] || 'oklch(0.78 0 0)';
};
