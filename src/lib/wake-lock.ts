/**
 * Request a screen wake lock. Returns a cleanup function that
 * releases it. No-op (and returns a no-op cleanup) if the API
 * is unavailable, the request is denied, or the page is
 * hidden.
 */
export async function acquireWakeLock(): Promise<() => void> {
  try {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') return () => {};
    if (document.hidden) return () => {};
    if (!('wakeLock' in navigator)) return () => {};

    // Narrow typing — Wake Lock API is not in all TS lib versions.
    const anyNav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const sentinel = await anyNav.wakeLock?.request('screen');
    if (!sentinel) return () => {};

    return () => {
      try { void sentinel.release(); } catch { /* no-op */ }
    };
  } catch {
    return () => {};
  }
}

