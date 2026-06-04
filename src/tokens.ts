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
  fontSize: {
    micro: '0.5625rem', // 9 px
    meta: '0.625rem', // 10 px
    tiny: '0.6875rem', // 11 px
    caption: '0.75rem', // 12 px
    captionLg: '0.78125rem', // 12.5 px
    small: '0.8125rem', // 13 px
    bodySm: '0.84375rem', // 13.5 px
    body: '0.875rem', // 14 px
    bodyLg: '0.9375rem', // 15 px
    base: '1rem', // 16 px
    lead: '1.0625rem', // 17 px
    title: '1.125rem', // 18 px
    subhead: '1.1875rem', // 19 px
    h2: '1.25rem', // 20 px
    section: '1.5rem', // 24 px
    heading: '1.375rem', // 22 px
    display: '1.75rem', // 28 px
    displayXl: '2rem', // 32 px
    hero: '2.25rem', // 36 px
  } as const,
} as const;

// Top padding reserves space for iOS status bar / notch.
export const SCREEN_PAD_TOP = 'max(54px, env(safe-area-inset-top))';
