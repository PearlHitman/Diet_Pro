// Storage layer — everything app-level reads/writes goes through here.
// Backed by IndexedDB via idb-keyval (zero ceremony, survives reloads,
// works offline, no quota issues for our scale).
//
// We use 5 keys: pantry, profile, settings, recipes, feed.
// Each is a single blob (small dataset, ≤50 recipes; loading all at once
// is fine and much simpler than per-record stores).

import { get, set, del } from 'idb-keyval';
import type { Category, Ingredient, Profile, Recipe, Settings } from './types';
import { resetOnboarded } from './onboarding-state';

const CATEGORY_SET = new Set<Category>(['produce', 'protein', 'dairy', 'grains', 'pantry', 'other']);

function normalizeRecipe(r: Recipe): Recipe {
  return {
    ...r,
    chefTips: Array.isArray(r.chefTips) ? r.chefTips.filter(x => typeof x === 'string') : [],
    serving: typeof r.serving === 'string' && r.serving.trim()
      ? r.serving
      : `Serves ${r.servings}`,
    ingredients: (r.ingredients ?? []).map(i => {
      const pc = i.pantryCategory;
      return {
        ...i,
        pantryCategory:
          pc !== undefined && CATEGORY_SET.has(pc) ? pc : undefined,
      };
    }),
  };
}

function coerceLoadedModel(saved: Partial<Settings> | undefined): Settings['model'] {
  const raw = saved?.model as string | undefined;
  if (raw === 'claude-opus-4-7') return 'claude-opus-4-5';
  if (raw === 'claude-haiku-4-5' || raw === 'claude-sonnet-4-5' || raw === 'claude-opus-4-5') {
    return raw;
  }
  return DEFAULT_SETTINGS.model;
}

// ─── Defaults ────────────────────────────────────────────────

const DEFAULT_PROFILE: Profile = {
  name: '',
  cuisine: '',
  servings: 2,
  level: 'Intermediate',
  allergies: '',
  dietGoal: 'None',
  language: 'EN',
  theme: 'system',
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
  feed:     'kitchen:feed:v1',
} as const;

// Expose feed key so feed.ts can share the same constant.
export const FEED_DB_KEY = K.feed;

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
  const raw = (await get<Recipe[]>(K.recipes)) ?? [];
  return raw.map(normalizeRecipe);
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
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}), model: coerceLoadedModel(saved) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(K.settings, settings);
}

// ─── Reset (debug helper, useful during dev) ─────────────────

export async function resetAll(): Promise<void> {
  await Promise.all([del(K.pantry), del(K.profile), del(K.recipes), del(K.settings), del(K.feed), resetOnboarded()]);
}
