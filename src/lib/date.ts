// Date helpers shared across pages and prompts.
//
// `daysUntil` was previously defined in three places (lib/prompts.ts,
// pages/PantryPage.tsx, with a near-identical helper in pages/HomePage.tsx
// via personalization). Centralising here so freshness logic has one home.

/**
 * Whole days between today (local midnight) and the given ISO date.
 * Positive when the date is in the future, negative when past, 0 = today.
 * Returns `null` if `isoDate` is `null` so callers don't have to branch twice.
 *
 * Accepts plain YYYY-MM-DD; appends T00:00:00 so it's evaluated in local time
 * (otherwise YYYY-MM-DD parses as UTC and shifts by up to a day either side).
 */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const expiry = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}
