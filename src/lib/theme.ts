// Theme management -- light / dark / system + warm editorial tones.
// Applies data-theme and data-tone attributes on <html> so theme.css
// picks the right palette. system defers to prefers-color-scheme.

export type ThemeMode = 'system' | 'light' | 'dark';
export type ToneMode  = 'warm-dark' | 'slate-dark' | 'espresso' | 'editorial-cream';

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else if (mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.setAttribute('data-theme', 'dark');
  }
}

export function applyTone(tone: ToneMode): void {
  const root = document.documentElement;
  if (tone === 'editorial-cream') {
    root.setAttribute('data-theme', 'light');
    root.removeAttribute('data-tone');
    return;
  }
  if (root.getAttribute('data-theme') === 'light') {
    root.removeAttribute('data-theme');
  }
  if (tone === 'warm-dark') {
    root.removeAttribute('data-tone');
  } else {
    root.setAttribute('data-tone', tone);
  }
}

export function effectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
