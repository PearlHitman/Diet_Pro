// Design tokens — single source of truth for colors, fonts, spacing.
// Lifted directly from your shell.jsx and converted to TypeScript.

export const T = {
  // Backgrounds
  bg:        'linear-gradient(180deg, #0a0a0f 0%, #14141c 100%)',
  surface:   'rgba(255,255,255,0.03)',
  surface2:  '#1a1a22',
  surfaceHi: 'rgba(255,255,255,0.05)',

  // Borders
  border:    'rgba(255,255,255,0.06)',
  borderHi:  'rgba(255,255,255,0.10)',
  borderAcc: 'rgba(212,165,116,0.5)',

  // Text
  text:      '#e8e8ee',
  text2:     '#a0a0aa',
  muted:     '#8a8a96',
  mute2:     '#6a6a72',

  // Accent (warm gold)
  accent:    '#d4a574',
  accent2:   '#b88a5a',
  accentGrad:'linear-gradient(135deg, #d4a574 0%, #b88a5a 100%)',
  accentTint:'rgba(212,165,116,0.10)',

  // Semantic
  warning:   '#fbbf24',
  warnTint:  'rgba(245,158,11,0.12)',
  warnBord:  'rgba(245,158,11,0.25)',
  danger:    '#f87171',
  dangerTint:'rgba(248,113,113,0.10)',
  success:   '#86efac',
  successTint:'rgba(74,222,128,0.10)',
  successBord:'rgba(74,222,128,0.25)',

  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
} as const;

// Top padding reserves space for iOS status bar / notch.
// On the design canvas this was 54px (status bar overlay); in a real PWA
// we use the device safe-area, falling back to 54px on browsers that
// don't expose it.
export const SCREEN_PAD_TOP = 'max(54px, env(safe-area-inset-top))';
