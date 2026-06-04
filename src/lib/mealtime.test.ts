/**
 * mealtime.test.ts
 *
 * Unit tests for getTimeOfDayPalette at every meal-window boundary.
 * We test: (a) period name, (b) that the returned hex is within ±5%
 * HSL distance from the expected interpolated value.
 */

import { describe, it, expect } from 'vitest';
import {
  getTimeOfDayPalette,
  MEAL_COLORS,
  mixHsl,
  hexToHsl,
} from './mealtime';

function makeDate(h: number, m = 0, s = 0): Date {
  const d = new Date(2024, 0, 15); // fixed day, arbitrary
  d.setHours(h, m, s, 0);
  return d;
}

/** Assert two hex colours are within `tolerance` in each HSL channel. */
function expectColorsClose(actual: string, expected: string, tolerance = 0.05) {
  const a = hexToHsl(actual);
  const e = hexToHsl(expected);
  const dh = Math.abs(a.h - e.h);
  const normalDH = Math.min(dh, 360 - dh) / 360; // normalise hue difference
  expect(normalDH, `hue: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.s - e.s), `sat: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.l - e.l), `lit: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

describe('getTimeOfDayPalette — period names', () => {
  it('04:30 → Dinner (late night, still in Dinner band)', () => {
    const { period } = getTimeOfDayPalette(makeDate(4, 30));
    expect(period).toBe('Dinner');
  });

  it('05:00 → Breakfast (boundary start, inclusive)', () => {
    const { period } = getTimeOfDayPalette(makeDate(5, 0));
    expect(period).toBe('Breakfast');
  });

  it('10:30 → Breakfast (inside transition zone, still Breakfast)', () => {
    const { period } = getTimeOfDayPalette(makeDate(10, 30));
    expect(period).toBe('Breakfast');
  });

  it('11:00 → Lunch (boundary start, inclusive)', () => {
    const { period } = getTimeOfDayPalette(makeDate(11, 0));
    expect(period).toBe('Lunch');
  });

  it('16:30 → Lunch (inside transition zone, still Lunch)', () => {
    const { period } = getTimeOfDayPalette(makeDate(16, 30));
    expect(period).toBe('Lunch');
  });

  it('17:00 → Dinner (boundary start, inclusive)', () => {
    const { period } = getTimeOfDayPalette(makeDate(17, 0));
    expect(period).toBe('Dinner');
  });

  it('23:00 → Dinner (middle of Dinner band)', () => {
    const { period } = getTimeOfDayPalette(makeDate(23, 0));
    expect(period).toBe('Dinner');
  });

  it('04:59 → Dinner (one minute before Breakfast)', () => {
    const { period } = getTimeOfDayPalette(makeDate(4, 59));
    expect(period).toBe('Dinner');
  });
});

describe('getTimeOfDayPalette — steady-state colors (outside transition zone)', () => {
  it('05:00 → pure Breakfast yellow', () => {
    const { color } = getTimeOfDayPalette(makeDate(5, 0));
    expectColorsClose(color, MEAL_COLORS.yellow);
  });

  it('08:00 → pure Breakfast yellow (middle of window)', () => {
    const { color } = getTimeOfDayPalette(makeDate(8, 0));
    expectColorsClose(color, MEAL_COLORS.yellow);
  });

  it('11:00 → pure Lunch green', () => {
    const { color } = getTimeOfDayPalette(makeDate(11, 0));
    expectColorsClose(color, MEAL_COLORS.green);
  });

  it('14:00 → pure Lunch green', () => {
    const { color } = getTimeOfDayPalette(makeDate(14, 0));
    expectColorsClose(color, MEAL_COLORS.green);
  });

  it('17:00 → pure Dinner orange', () => {
    const { color } = getTimeOfDayPalette(makeDate(17, 0));
    expectColorsClose(color, MEAL_COLORS.orange);
  });

  it('21:00 → pure Dinner orange', () => {
    const { color } = getTimeOfDayPalette(makeDate(21, 0));
    expectColorsClose(color, MEAL_COLORS.orange);
  });
});

describe('getTimeOfDayPalette — transition zone interpolation', () => {
  it('10:30 → ~50% mix of yellow→green (ease-in-out at k=0.5)', () => {
    // 10:30 is 0.5h before boundary at 11:00 → k=0.5, eased e≈0.5
    const { color } = getTimeOfDayPalette(makeDate(10, 30));
    const k = 0.5;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const expected = mixHsl(MEAL_COLORS.yellow, MEAL_COLORS.green, e);
    expectColorsClose(color, expected, 0.06);
  });

  it('16:30 → ~50% mix of green→orange', () => {
    const { color } = getTimeOfDayPalette(makeDate(16, 30));
    const k = 0.5;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const expected = mixHsl(MEAL_COLORS.green, MEAL_COLORS.orange, e);
    expectColorsClose(color, expected, 0.06);
  });

  it('10:00 → just entering transition zone (remaining=1h, k≈0)', () => {
    // At exactly the transition boundary start, color should still be ~yellow
    const { color } = getTimeOfDayPalette(makeDate(10, 0));
    expectColorsClose(color, MEAL_COLORS.yellow, 0.06);
  });

  it('10:59 → almost at Lunch boundary (remaining≈0.017h, k≈0.983 → ~orange-ish green)', () => {
    const { color, period } = getTimeOfDayPalette(makeDate(10, 59));
    expect(period).toBe('Breakfast');
    // Color should be heavily biased toward green
    const green = hexToHsl(MEAL_COLORS.green);
    const actual = hexToHsl(color);
    // Hue should be within 30° of green's hue
    const dh = Math.abs(actual.h - green.h);
    expect(Math.min(dh, 360 - dh)).toBeLessThan(30);
  });
});

describe('getTimeOfDayPalette — nextBoundary24', () => {
  it('Breakfast band → nextBoundary24 is 11', () => {
    const { nextBoundary24 } = getTimeOfDayPalette(makeDate(7, 0));
    expect(nextBoundary24).toBe(11);
  });

  it('Lunch band → nextBoundary24 is 17', () => {
    const { nextBoundary24 } = getTimeOfDayPalette(makeDate(13, 0));
    expect(nextBoundary24).toBe(17);
  });

  it('Dinner band → nextBoundary24 is 5 (29 % 24)', () => {
    const { nextBoundary24 } = getTimeOfDayPalette(makeDate(20, 0));
    expect(nextBoundary24).toBe(5);
  });
});
