// Storage layer — everything app-level reads/writes goes through here.
// Backed by IndexedDB via idb-keyval (zero ceremony, survives reloads,
// works offline, no quota issues for our scale).
//
// We use 4 keys: pantry, profile, settings, recipes.
// Each is a single blob (small dataset, ≤50 recipes; loading all at once
// is fine and much simpler than per-record stores).

import { get, set, del } from 'idb-keyval';
import type { Ingredient, Profile, Recipe, Settings } from './types';
import { resetOnboarded } from './onboarding-state';

// ─── Defaults ────────────────────────────────────────────────

const DEFAULT_PROFILE: Profile = {
  name: '',
  cuisine: '',
  servings: 2,
  level: 'Intermediate',
  allergies: '',
  dietGoal: 'None',
  language: 'EN',
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-5',
};

// ─── Keys ────────────────────────────────────────────────────

const K = {
  pantry:   'kitchen:pantry:v1',
  profile:  'kitchen:profile:v1',
  recipes:  'kitchen:recipes:v1',
  settings: 'kitchen:settings:v1',
} as const;

// ─── Pantry ──────────────────────────────────────────────────

export async function loadPantry(): Promise<Ingredient[]> {
  return (await get<Ingredient[]>(K.pantry)) ?? [];
}

export async function savePantry(items: Ingredient[]): Promise<void> {
  await set(K.pantry, items);
}

// ─── Profile ─────────────────────────────────────────────────

export async function loadProfile(): Promise<Profile> {
  const saved = await get<Partial<Profile>>(K.profile);
  return { ...DEFAULT_PROFILE, ...(saved ?? {}) };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await set(K.profile, profile);
}

// ─── Recipes (history + favorites in one list) ───────────────

export async function loadRecipes(): Promise<Recipe[]> {
  return (await get<Recipe[]>(K.recipes)) ?? [];
}

export async function saveRecipes(recipes: Recipe[]): Promise<void> {
  await set(K.recipes, recipes);
}

// Convenience: prepend new recipes, cap at 50 unless starred.
// Starred recipes are never evicted by the cap.
export async function addRecipes(newOnes: Recipe[]): Promise<void> {
  const existing = await loadRecipes();
  const combined = [...newOnes, ...existing];
  const starred = combined.filter(r => r.starred);
  const unstarred = combined.filter(r => !r.starred).slice(0, 50);
  await saveRecipes([...starred, ...unstarred]);
}

// ─── Settings ────────────────────────────────────────────────

export async function loadSettings(): Promise<Settings> {
  const saved = await get<Partial<Settings>>(K.settings);
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(K.settings, settings);
}

// ─── Reset (debug helper, useful during dev) ─────────────────

export async function resetAll(): Promise<void> {
  await Promise.all([del(K.pantry), del(K.profile), del(K.recipes), del(K.settings), resetOnboarded()]);
}
