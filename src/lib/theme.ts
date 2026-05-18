// Theme management — light / dark / system, persisted to the user's profile.
// Applies a `data-theme` attribute on <html> so theme.css picks the right
// palette. `system` removes the attribute and lets prefers-color-scheme rule.

export type ThemeMode = 'system' | 'light' | 'dark';

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

/** Resolve the theme actually being shown right now (system → light|dark). */
export function effectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
