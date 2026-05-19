// Nutrition calculations — TDEE, macro targets, daily totals.
// Pure functions, no side effects. Safe to import anywhere.

import type { ActivityLevel, BodyStats, DietGoal, LoggedMeal, NutritionGoals } from './types';

// ─── TDEE (Mifflin-St Jeor) ──────────────────────────────────

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:  1.2,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  very_active: 1.9,
};

/** Basal metabolic rate, kcal/day. */
function bmr(stats: BodyStats): number {
  const base = 10 * stats.weight + 6.25 * stats.height - 5 * stats.age;
  return stats.sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure, kcal/day. */
export function computeTDEE(stats: BodyStats): number {
  return Math.round(bmr(stats) * ACTIVITY_MULTIPLIER[stats.activityLevel]);
}

// ─── Macro splits per goal ───────────────────────────────────
//
// Ratios of total kcal, then converted to grams.
// protein/carbs: 4 kcal/g  ·  fat: 9 kcal/g

type MacroRatio = { protein: number; carbs: number; fat: number }; // fractions summing to 1

const MACRO_RATIO: Record<DietGoal, MacroRatio> = {
  'None':        { protein: 0.20, carbs: 0.50, fat: 0.30 },
  'Weight loss': { protein: 0.40, carbs: 0.35, fat: 0.25 },
  'Muscle':      { protein: 0.35, carbs: 0.45, fat: 0.20 },
  'Health':      { protein: 0.25, carbs: 0.50, fat: 0.25 },
};

// Calorie adjustment vs. TDEE per goal (kcal/day).
const CALORIE_DELTA: Record<DietGoal, number> = {
  'None':        0,
  'Weight loss': -400,
  'Muscle':      +250,
  'Health':      0,
};

/**
 * Compute daily calorie + macro targets from body stats and diet goal.
 * Returns null when bodyStats is null (not set up yet).
 */
export function computeNutritionGoals(
  stats: BodyStats | null,
  dietGoal: DietGoal,
): NutritionGoals | null {
  if (!stats) return null;
  const tdee = computeTDEE(stats);
  const calories = Math.max(1200, tdee + CALORIE_DELTA[dietGoal]);
  const ratio = MACRO_RATIO[dietGoal];
  return {
    calories,
    protein: Math.round((calories * ratio.protein) / 4),
    carbs:   Math.round((calories * ratio.carbs)   / 4),
    fat:     Math.round((calories * ratio.fat)      / 9),
  };
}

// ─── Daily totals ────────────────────────────────────────────

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function sumMeals(meals: LoggedMeal[]): DayTotals {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + Math.round(m.calories * m.servings),
      protein:  acc.protein  + Math.round(m.protein  * m.servings),
      carbs:    acc.carbs    + Math.round(m.carbs     * m.servings),
      fat:      acc.fat      + Math.round(m.fat       * m.servings),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** ISO date string for a given date, e.g. "2026-05-19". */
export function toDateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Last N days as YYYY-MM-DD strings, oldest first. */
export function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateStr(d));
  }
  return days;
}
