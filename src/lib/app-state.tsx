// Global app state via React Context.
// One provider at the top of the tree; hooks pull what each page needs.
// Writes immediately persist to IndexedDB (no debounce — IDB is fast,
// state set is rare).

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { BodyStats, Ingredient, LoggedMeal, Profile, Recipe, Settings, WeekMealPlan } from './types';
import * as db from './db';
import { t as translate } from './i18n';
import { applyTheme } from './theme';

/* eslint-disable react-refresh/only-export-components */
interface AppState {
  // Data
  pantry: Ingredient[];
  profile: Profile;
  recipes: Recipe[];
  settings: Settings;
  bodyStats: BodyStats | null;
  nutritionLog: LoggedMeal[];
  mealPlan: WeekMealPlan | null;
  ready: boolean;

  // Pantry mutations
  addIngredient: (item: Ingredient) => Promise<void>;
  bulkAddIngredients: (items: Ingredient[]) => Promise<void>;
  restoreIngredientAt: (index: number, item: Ingredient) => Promise<void>;
  updateIngredient: (id: string, patch: Partial<Ingredient>) => Promise<void>;
  removeIngredient: (id: string) => Promise<void>;

  // Profile / settings
  saveProfile: (profile: Profile) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;

  // Recipes
  appendRecipes: (newOnes: Recipe[]) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;

  // Body stats & nutrition
  saveBodyStats: (stats: BodyStats) => Promise<void>;
  addLoggedMeal: (meal: LoggedMeal) => Promise<void>;
  removeLoggedMeal: (id: string) => Promise<void>;

  // Meal plan
  saveMealPlan: (plan: WeekMealPlan) => Promise<void>;
  updateMealPlan: (plan: WeekMealPlan) => Promise<void>;
  clearMealPlan: () => Promise<void>;

  // Reset
  resetAll: () => Promise<void>;

  // Export / import (manual cross-device "sync")
  exportData: () => Promise<db.ExportPayload>;
  importData: (raw: unknown) => Promise<void>;

  // i18n shortcut
  t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [pantry, setPantry] = useState<Ingredient[]>([]);
  const [profile, setProfileState] = useState<Profile>({
    name: '', cuisine: '', servings: 2, level: 'Intermediate',
    allergies: '', dietGoal: 'None', language: 'EN', theme: 'system',
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettingsState] = useState<Settings>({ apiKey: '', model: 'claude-sonnet-4-5', recipeSpeed: 'best', byok: false });
  const [bodyStats, setBodyStatsState] = useState<BodyStats | null>(null);
  const [nutritionLog, setNutritionLog] = useState<LoggedMeal[]>([]);
  const [mealPlan, setMealPlanState] = useState<WeekMealPlan | null>(null);
  const [ready, setReady] = useState(false);

  // Initial load.
  useEffect(() => {
    (async () => {
      const [p, pr, r, s, bs, nl, mp] = await Promise.all([
        db.loadPantry(), db.loadProfile(), db.loadRecipes(), db.loadSettings(),
        db.loadBodyStats(), db.loadNutritionLog(), db.loadMealPlan(),
      ]);
      setPantry(p);
      setProfileState(pr);
      setRecipes(r);
      setSettingsState(s);
      setBodyStatsState(bs);
      setNutritionLog(nl);
      setMealPlanState(mp);
      setReady(true);
    })();
  }, []);

  // ─── Pantry ─────────────────────────────────────────────────

  const addIngredient = useCallback(async (item: Ingredient) => {
    const next = [item, ...pantry];
    setPantry(next);
    await db.savePantry(next);
  }, [pantry]);

  const bulkAddIngredients = useCallback(async (items: Ingredient[]) => {
    const next = [...items, ...pantry];
    setPantry(next);
    await db.savePantry(next);
  }, [pantry]);

  const restoreIngredientAt = useCallback(async (index: number, item: Ingredient) => {
    const next = [...pantry];
    const idx = Math.max(0, Math.min(index, next.length));
    next.splice(idx, 0, item);
    setPantry(next);
    await db.savePantry(next);
  }, [pantry]);

  const updateIngredient = useCallback(async (id: string, patch: Partial<Ingredient>) => {
    const next = pantry.map(it => it.id === id ? { ...it, ...patch } : it);
    setPantry(next);
    await db.savePantry(next);
  }, [pantry]);

  const removeIngredient = useCallback(async (id: string) => {
    const next = pantry.filter(it => it.id !== id);
    setPantry(next);
    await db.savePantry(next);
  }, [pantry]);

  // ─── Profile / settings ─────────────────────────────────────

  const saveProfile = useCallback(async (next: Profile) => {
    setProfileState(next);
    await db.saveProfile(next);
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    setSettingsState(next);
    await db.saveSettings(next);
  }, []);

  // ─── Recipes ────────────────────────────────────────────────

  const appendRecipes = useCallback(async (newOnes: Recipe[]) => {
    await db.addRecipes(newOnes);
    setRecipes(await db.loadRecipes());
  }, []);

  const toggleStar = useCallback(async (id: string) => {
    const next = recipes.map(r => r.id === id ? { ...r, starred: !r.starred } : r);
    setRecipes(next);
    await db.saveRecipes(next);
  }, [recipes]);

  // ─── Body stats & nutrition ──────────────────────────────────

  const saveBodyStats = useCallback(async (stats: BodyStats) => {
    setBodyStatsState(stats);
    await db.saveBodyStats(stats);
  }, []);

  const addLoggedMeal = useCallback(async (meal: LoggedMeal) => {
    await db.addLoggedMeal(meal);
    setNutritionLog(await db.loadNutritionLog());
  }, []);

  const removeLoggedMeal = useCallback(async (id: string) => {
    await db.removeLoggedMeal(id);
    setNutritionLog(prev => prev.filter(m => m.id !== id));
  }, []);

  const saveMealPlan = useCallback(async (plan: WeekMealPlan) => {
    setMealPlanState(plan);
    await db.saveMealPlan(plan);
  }, []);

  const updateMealPlan = saveMealPlan;

  const clearMealPlan = useCallback(async () => {
    setMealPlanState(null);
    await db.deleteMealPlan();
  }, []);

  // ─── Reset ──────────────────────────────────────────────────

  const resetAll = useCallback(async () => {
    await db.resetAll();
    setPantry([]);
    setProfileState({
      name: '', cuisine: '', servings: 2, level: 'Intermediate',
      allergies: '', dietGoal: 'None', language: 'EN', theme: 'system',
    });
    setRecipes([]);
    setSettingsState({ apiKey: '', model: 'claude-sonnet-4-5', recipeSpeed: 'best', byok: false });
    setBodyStatsState(null);
    setNutritionLog([]);
    setMealPlanState(null);
  }, []);

  const exportData = useCallback(() => db.exportAllData(), []);

  const importData = useCallback(async (raw: unknown) => {
    await db.importAllData(raw);
    // Reload all in-memory state from disk so the UI reflects the import.
    const [p, pr, r, s] = await Promise.all([
      db.loadPantry(), db.loadProfile(), db.loadRecipes(), db.loadSettings(),
    ]);
    setPantry(p);
    setProfileState(pr);
    setRecipes(r);
    setSettingsState(s);
  }, []);

  // Re-apply theme whenever profile.theme changes (incl. on first load).
  useEffect(() => {
    applyTheme(profile.theme);
  }, [profile.theme]);

  // ─── i18n bound to current language ─────────────────────────

  const t = useCallback(
    (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
      translate(profile.language, key, vars),
    [profile.language],
  );

  const value: AppState = {
    pantry, profile, recipes, settings, bodyStats, nutritionLog, mealPlan, ready,
    addIngredient, bulkAddIngredients, restoreIngredientAt, updateIngredient, removeIngredient,
    saveProfile, saveSettings,
    appendRecipes, toggleStar,
    saveBodyStats, addLoggedMeal, removeLoggedMeal,
    saveMealPlan, updateMealPlan, clearMealPlan,
    resetAll,
    exportData, importData,
    t,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
