/**
 * Mise mealtime palette engine.
 *
 * Ported verbatim from prototype/mise-app.jsx -- same boundary hours,
 * same 60-min crossfade window, same HSL interpolation logic.
 *
 * Three meal windows. Color holds steady inside the window, then
 * crossfades (ease-in-out, HSL) over ~60 min before the next boundary.
 *
 * Usage:
 *   const { color, period } = useMealtimePalette();
 *   // `color` is a hex string; applied to --primary automatically.
 */

import { useEffect, useState, useRef } from 'react';

// -- Meal colours
export const MEAL_COLORS = {
  yellow: '#c4a13a', // Breakfast
  green:  '#6a8a4d', // Lunch
  orange: '#e08456', // Dinner
} as const;

// -- Bands: [startHour, endHour, colorKey, periodName]
// Hours on a 5..29 scale (5 am reference so late night stays in Dinner).
export const MEAL_BANDS = [
  [5,  11, 'yellow', 'Breakfast'],
  [11, 17, 'green',  'Lunch'],
  [17, 29, 'orange', 'Dinner'],
] as const;

export const TRANSITION_HOURS = 1;

// -- Result type
export interface MealtimePalette {
  color:          string;
  period:         string;
  nextPeriod:     string;
  nextBoundary24: number;
  baseColor:      string;
  nextColor:      string;
}

// -- Color math

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue *= 60;
  }
  return { h: hue, s, l };
}

export function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0, g = 0, b = 0;
  if      (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else             [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function mixHsl(a: string, b: string, t: number): string {
  const A = hexToHsl(a);
  const B = hexToHsl(b);
  let dh = B.h - A.h;
  if (dh > 180)  dh -= 360;
  if (dh < -180) dh += 360;
  return hslToHex({
    h: A.h + dh * t,
    s: A.s + (B.s - A.s) * t,
    l: A.l + (B.l - A.l) * t,
  });
}

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function lightenHex(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v + 255 * amt)));
  return `#${[h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]
    .map(s => c(parseInt(s, 16)).toString(16).padStart(2, '0'))
    .join('')}`;
}

// -- Core palette function

export function getTimeOfDayPalette(date: Date = new Date()): MealtimePalette {
  const raw = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const h = raw < 5 ? raw + 24 : raw;

  let bandIdx = MEAL_BANDS.findIndex(([s, e]) => h >= s && h < e);
  if (bandIdx < 0) bandIdx = 0;

  const [, be, colorKey, period] = MEAL_BANDS[bandIdx];
  const next = MEAL_BANDS[(bandIdx + 1) % MEAL_BANDS.length];
  const nextColorKey = next[2] as keyof typeof MEAL_COLORS;
  const nextPeriod   = next[3];

  const baseColor = MEAL_COLORS[colorKey as keyof typeof MEAL_COLORS];
  const nextColor = MEAL_COLORS[nextColorKey];

  const remaining = be - h;
  let color: string = baseColor;
  if (remaining < TRANSITION_HOURS) {
    const k = 1 - remaining / TRANSITION_HOURS;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    color = mixHsl(baseColor, nextColor, e);
  }

  const nextBoundary24 = (be as number) % 24;

  return { color, period, nextPeriod, nextBoundary24, baseColor, nextColor };
}

// -- React hook

/**
 * useMealtimePalette
 *
 * Computes the current mealtime primary color and re-evaluates every 60 s.
 * Also writes --primary (and derived tokens) directly to document root.
 *
 * @param autoColor  When false, skips the time-of-day logic and returns null.
 */
export function useMealtimePalette(autoColor = true): MealtimePalette | null {
  const [palette, setPalette] = useState<MealtimePalette | null>(() =>
    autoColor ? getTimeOfDayPalette() : null,
  );
  const autoRef = useRef(autoColor);
  autoRef.current = autoColor;

  useEffect(() => {
    if (!autoColor) {
      setPalette(null);
      return;
    }

    function tick() {
      if (!autoRef.current) return;
      const p = getTimeOfDayPalette();
      setPalette(p);
      applyPrimaryToRoot(p.color);
    }

    tick();

    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [autoColor]);

  return palette;
}

/**
 * Apply a hex primary colour to document root CSS vars.
 */
export function applyPrimaryToRoot(hex: string): void {
  const root = document.documentElement;
  root.style.setProperty('--primary',             hex);
  root.style.setProperty('--primary-hover',       lightenHex(hex, 0.08));
  root.style.setProperty('--primary-dim',         hexToRgba(hex, 0.13));
  root.style.setProperty('--primary-glow',        hexToRgba(hex, 0.35));
  root.style.setProperty('--mise-primary',        hex);
  root.style.setProperty('--mise-primary-hover',  lightenHex(hex, 0.08));
}
