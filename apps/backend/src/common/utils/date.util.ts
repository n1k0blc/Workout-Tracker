/**
 * Date utilities for testing and development
 * 
 * SECURITY: Mock date only works in development mode (NODE_ENV=development)
 * Production will ALWAYS use real date regardless of MOCK_DATE env variable
 * 
 * Usage:
 * 1. Create .env.local in apps/backend/
 * 2. Add: NODE_ENV=development
 * 3. Add: MOCK_DATE=2026-04-05
 * 4. Restart backend
 * 5. New workouts will use mocked date
 */

/**
 * Get current date, or mocked date if MOCK_DATE env variable is set
 * 
 * SECURITY LAYERS:
 * - Only works if NODE_ENV === 'development'
 * - .env.local is gitignored (never committed)
 * - .env.production has no MOCK_DATE
 * - Console warning when mock is active
 */
export function getCurrentDate(): Date {
  const mockDate = process.env.MOCK_DATE;
  const nodeEnv = process.env.NODE_ENV;
  
  // SECURITY: Never mock in production
  if (nodeEnv !== 'development') {
    return new Date();
  }
  
  if (mockDate) {
    const parsed = new Date(mockDate);
    
    if (!isNaN(parsed.getTime())) {
      // Get current time components
      const now = new Date();
      
      // Combine mock date with real time
      const combined = new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
      
      console.warn(
        `⚠️  MOCK_DATE ACTIVE: Using ${mockDate} with current time ${combined.toISOString()} ` +
        `(NODE_ENV=${nodeEnv})`
      );
      return combined;
    } else {
      console.error(
        `❌ Invalid MOCK_DATE format: "${mockDate}". ` +
        `Use YYYY-MM-DD format. Falling back to real date.`
      );
    }
  }
  
  return new Date();
}

/**
 * Get current ISO string, respecting MOCK_DATE
 */
export function getCurrentISOString(): string {
  return getCurrentDate().toISOString();
}

/**
 * Check if mock date is currently active
 */
export function isMockDateActive(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    !!process.env.MOCK_DATE &&
    !isNaN(new Date(process.env.MOCK_DATE!).getTime())
  );
}

/**
 * Canonical cycle-week formula (§3.11) -- previously computed three different ways
 * across dashboard/cycles/engine (two used `floor`, one used `ceil`, disagreeing near
 * week boundaries). 1-indexed, capped at the cycle's total duration.
 */
export function calculateCycleWeek(startDate: Date, duration: number, now: Date = getCurrentDate()): number {
  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7) + 1, duration);
}
