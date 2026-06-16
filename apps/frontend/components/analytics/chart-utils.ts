// Common formatters used across analytics charts (main analytics + cycle detail).
// These were duplicated in both pages; now centralized.

const formatDateInternal = (dateStr: string) => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('de-DE').format(Math.round(num));
};

export const formatXAxisLabel = (entry: any) => {
  if (entry?.weekLabel) {
    return entry.weekLabel;
  }
  return formatDateInternal(entry?.date);
};

export const formatTooltipLabel = (entry: any) => {
  if (entry?.weekStartDate && entry?.weekEndDate) {
    const start = formatDateInternal(entry.weekStartDate);
    const end = formatDateInternal(entry.weekEndDate);
    const workoutCount = entry.workoutCount || 0;
    return `${start} - ${end} (${workoutCount} Workout${workoutCount !== 1 ? 's' : ''})`;
  }
  return formatDateInternal(entry?.date);
};

export const formatDate = formatDateInternal;

// Default number formatter (can be overridden per chart)
export { formatNumber as formatNumberInternal };
