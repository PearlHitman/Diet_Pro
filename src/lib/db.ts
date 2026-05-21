// Storage layer — everything app-level reads/writes goes through here.
// Backed by IndexedDB via idb-keyval (zero ceremony, survives reloads,
// works offline, no quota issues for our scale).
//
// We use 5 keys: pantry, profile, settings, recipes, feed.
// Each is a single blob (small dataset, ≤50 recipes; loading all at once
// is fine and much simpler than per-record stores).

import { get, set, del } from 'idb-keyval';
import { CATEGORY_SET, type BodyStats, type Ingredient, type LoggedMeal, type Profile, type Recipe, type Settings } from './types';
import { resetOnboarded } from './onboarding-state';

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

function coerceLoadedRecipeSpeed(saved: Partial<Settings> | undefined): Settings['recipeSpeed'] {
  const raw = saved?.recipeSpeed;
  if (raw === 'fast' || raw === 'best') return raw;
  return DEFAULT_SETTINGS.recipeSpeed;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-5',
  recipeSpeed: 'best',
  byok: false,
};

// ─── Keys ────────────────────────────────────────────────────

const K = {
  pantry:     'kitchen:pantry:v1',
  profile:    'kitchen:profile:v1',
  recipes:    'kitchen:recipes:v1',
  settings:   'kitchen:settings:v1',
  feed:       'kitchen:feed:v1',
  bodyStats:  'kitchen:bodystats:v1',
  nutrition:  'kitchen:nutrition:v1',
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
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    model: coerceLoadedModel(saved),
    recipeSpeed: coerceLoadedRecipeSpeed(saved),
    // Existing users who saved settings before byok existed get false (proxy mode).
    byok: typeof saved?.byok === 'boolean' ? saved.byok : false,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(K.settings, settings);
}

// ─── Body stats ──────────────────────────────────────────────

export async function loadBodyStats(): Promise<BodyStats | null> {
  return (await get<BodyStats>(K.bodyStats)) ?? null;
}

export async function saveBodyStats(stats: BodyStats): Promise<void> {
  await set(K.bodyStats, stats);
}

// ─── Nutrition log ───────────────────────────────────────────
// Capped at 90 days of entries on write.

const NUTRITION_LOG_MAX_DAYS = 90;

export async function loadNutritionLog(): Promise<LoggedMeal[]> {
  return (await get<LoggedMeal[]>(K.nutrition)) ?? [];
}

export async function saveNutritionLog(log: LoggedMeal[]): Promise<void> {
  await set(K.nutrition, log);
}

export async function addLoggedMeal(meal: LoggedMeal): Promise<void> {
  const log = await loadNutritionLog();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NUTRITION_LOG_MAX_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const pruned = log.filter(m => m.date >= cutoffStr);
  await saveNutritionLog([meal, ...pruned]);
}

export async function removeLoggedMeal(id: string): Promise<void> {
  const log = await loadNutritionLog();
  await saveNutritionLog(log.filter(m => m.id !== id));
}

// ─── Reset (debug helper, useful during dev) ─────────────────

export async function resetAll(): Promise<void> {
  await Promise.all([
    del(K.pantry), del(K.profile), del(K.recipes),
    del(K.settings), del(K.feed), del(K.bodyStats), del(K.nutrition),
    resetOnboarded(),
  ]);
}

// ─── Export / Import (manual cross-device "sync") ────────────
//
// We deliberately *do not* include the API key in the export — users
// may share or back up these files, and Anthropic keys are easy to
// re-paste from console.anthropic.com on a new device. Everything else
// they actually generated (pantry, recipes, profile, model choice) is
// included.

export const EXPORT_FORMAT_VERSION = 1;

export interface ExportPayload {
  format: 'mise-export';
  version: number;
  exportedAt: string; // ISO datetime
  pantry: Ingredient[];
  profile: Profile;
  recipes: Recipe[];
  settings: Omit<Settings, 'apiKey'>;
}

export async function exportAllData(): Promise<ExportPayload> {
  const [pantry, profile, recipes, settings] = await Promise.all([
    loadPantry(), loadProfile(), loadRecipes(), loadSettings(),
  ]);
  // Strip API key before exporting.
  const { apiKey: _apiKey, ...safeSettings } = settings;
  void _apiKey;
  return {
    format: 'mise-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    pantry,
    profile,
    recipes,
    settings: safeSettings,
  };
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Validate and apply an imported payload. Existing data is replaced
 * (not merged) — merging is ambiguous when ingredient IDs collide.
 * Throws an Error with a user-readable message on bad payloads.
 *
 * The current API key is preserved; the import never touches it.
 */
export async function importAllData(raw: unknown): Promise<void> {
  if (!isPlainObject(raw) || raw.format !== 'mise-export') {
    throw new Error('That doesn\'t look like a Mise export file.');
  }
  if (typeof raw.version !== 'number' || raw.version > EXPORT_FORMAT_VERSION) {
    throw new Error('Export file is from a newer version of the app.');
  }
  if (!Array.isArray(raw.pantry) || !Array.isArray(raw.recipes)
      || !isPlainObject(raw.profile) || !isPlainObject(raw.settings)) {
    throw new Error('Export file is missing required sections.');
  }

  const currentSettings = await loadSettings();
  const importedSettings = raw.settings as Partial<Settings>;
  const mergedSettings: Settings = {
    ...currentSettings,
    // Allow model override from the imported file; never the API key.
    model: importedSettings.model
      ? coerceLoadedModel(importedSettings)
      : currentSettings.model,
    recipeSpeed: importedSettings.recipeSpeed
      ? coerceLoadedRecipeSpeed(importedSettings)
      : currentSettings.recipeSpeed,
  };

  await Promise.all([
    savePantry(raw.pantry as Ingredient[]),
    saveProfile({ ...(await loadProfile()), ...(raw.profile as Partial<Profile>) }),
    saveRecipes((raw.recipes as Recipe[]).map(normalizeRecipe)),
    saveSettings(mergedSettings),
  ]);
}
