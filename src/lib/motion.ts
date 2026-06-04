/**
 * True when the OS / browser is set to "Reduce motion".
 * Safe on the server (returns false). Re-reads each call —
 * users rarely change this mid-session, so a hook isn't needed
 * for our use cases.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
