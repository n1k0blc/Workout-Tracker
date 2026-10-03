// Common formatters used across analytics charts (main analytics + cycle detail).
// These were duplicated in both pages; now centralized.
//
// `locale` is an optional trailing param on every formatter here (default 'de-DE', matching
// the previous hardcoded behavior) so the main analytics page can thread the active next-intl
// locale through while the cycle detail page's existing calls -- which pass no locale -- stay
// byte-for-byte unaffected.

const formatDateInternal = (dateStr: string, locale = 'de-DE') => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

export const formatNumber = (num: number, locale = 'de-DE') => {
  return new Intl.NumberFormat(locale).format(Math.round(num));
};

export const formatXAxisLabel = (entry: any, locale = 'de-DE') => {
  if (entry?.weekLabel) {
    return entry.weekLabel;
  }
  return formatDateInternal(entry?.date, locale);
};

export const formatTooltipLabel = (
  entry: any,
  locale = 'de-DE',
  formatWorkoutCount?: (count: number) => string,
) => {
  if (entry?.weekStartDate && entry?.weekEndDate) {
    const start = formatDateInternal(entry.weekStartDate, locale);
    const end = formatDateInternal(entry.weekEndDate, locale);
    const workoutCount = entry.workoutCount || 0;
    const workoutCountLabel = formatWorkoutCount
      ? formatWorkoutCount(workoutCount)
      : `${workoutCount} Workout${workoutCount !== 1 ? 's' : ''}`;
    return `${start} - ${end} (${workoutCountLabel})`;
  }
  return formatDateInternal(entry?.date, locale);
};

export const formatDate = formatDateInternal;

// Default number formatter (can be overridden per chart)
export { formatNumber as formatNumberInternal };
