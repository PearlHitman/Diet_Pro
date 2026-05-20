// Design tokens — compat shim mapping legacy `T.*` names to the new
// Mise Liquid Glass CSS variables (defined in styles/theme.css).
//
// New code should reference `var(--mise-*)` directly. This shim keeps
// pages that still use `T.*` rendering with the new light/glass/purple
// palette without rewriting every inline style.

export const T = {
  // Backgrounds
  bg:        'var(--mise-background)',
  surface:   'var(--mise-glass-fill)',
  surface2:  'var(--mise-glass-elevated)',
  surfaceHi: 'rgba(255,255,255,0.5)',

  // Borders
  border:    'var(--mise-glass-border)',
  borderHi:  'var(--mise-glass-border)',
  borderAcc: 'rgba(124,58,237,0.5)',

  // Text (muted / text2 follow --mise-text-secondary • theme.css contrast tuning)
  text:      'var(--mise-text-primary)',
  text2:     'var(--mise-text-secondary)',
  muted:     'var(--mise-text-secondary)',
  mute2:     'var(--mise-text-tertiary)',

  // Accent (purple)
  accent:    'var(--mise-primary)',
  accent2:   'var(--mise-primary-hover)',
  accentGrad: 'linear-gradient(135deg, var(--mise-primary) 0%, var(--mise-secondary) 100%)',
  accentTint: 'rgba(124,58,237,0.10)',

  // Semantic
  warning:    'var(--mise-warning)',
  warnTint:   'rgba(245,158,11,0.10)',
  warnBord:   'rgba(245,158,11,0.25)',
  danger:     'var(--mise-error)',
  dangerTint: 'rgba(239,68,68,0.10)',
  success:    'var(--mise-success)',
  successTint:'rgba(16,185,129,0.10)',
  successBord:'rgba(16,185,129,0.25)',

  font: 'var(--mise-font-text)',
} as const;

// Top padding reserves space for iOS status bar / notch.
export const SCREEN_PAD_TOP = 'max(54px, env(safe-area-inset-top))';
