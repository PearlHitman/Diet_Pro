// Tests for the IndexedDB persistence layer.
// idb-keyval is mocked with an in-memory Map so these run fast and
// deterministically — we're testing db.ts's logic, not the browser's IDB.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Ingredient, Recipe } from './types';

// vi.hoisted lets the same Map be referenced by both the mock factory
// (hoisted to the top of the file) and the beforeEach reset below.
const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v); },
  del: async (k: string) => { store.delete(k); },
}));

import {
  loadPantry, savePantry,
  loadProfile, saveProfile,
  loadRecipes, addRecipes,
  loadSettings, saveSettings,
  resetAll,
} from './db';

beforeEach(() => store.clear());

// ─── Test data factories ─────────────────────────────────────

function makeIngredient(name: string): Ingredient {
  return {
    id: `id-${name}`,
    name,
    category: 'produce',
    expiresOn: null,
    addedAt: new Date().toISOString(),
  };
}

function makeRecipe(id: string, starred = false): Recipe {
  return {
    id,
    name: `Recipe ${id}`,
    cookTime: 20,
    difficulty: 'Beginner',
    calories: 300,
    servings: 2,
    ingredients: [],
    steps: ['Cook it.'],
    chefTips: [],
    serving: 'Serves 2',
    mealType: 'quick',
    createdAt: new Date().toISOString(),
    starred,
  };
}

// ─── Pantry ──────────────────────────────────────────────────

describe('pantry storage', () => {
  it('returns an empty array when nothing is stored', async () => {
    expect(await loadPantry()).toEqual([]);
  });

  it('round-trips saved ingredients', async () => {
    const items = [makeIngredient('eggs'), makeIngredient('flour')];
    await savePantry(items);
    expect(await loadPantry()).toEqual(items);
  });
});

// ─── Profile ─────────────────────────────────────────────────

describe('profile storage', () => {
  it('returns the full default profile when nothing is stored', async () => {
    const p = await loadProfile();
    expect(p.servings).toBe(2);
    expect(p.language).toBe('EN');
    expect(p.level).toBe('Intermediate');
  });

  it('merges a saved partial profile over the defaults', async () => {
    // Simulate an older/partial record missing newer fields.
    store.set('kitchen:profile:v1', { name: 'Iraklis', servings: 4 });
    const p = await loadProfile();
    expect(p.name).toBe('Iraklis');
    expect(p.servings).toBe(4);
    expect(p.language).toBe('EN'); // still defaulted
  });

  it('round-trips a saved profile', async () => {
    const profile = {
      name: 'Maria', cuisine: 'Greek', servings: 3,
      level: 'Expert' as const, allergies: '', dietGoal: 'Health' as const,
      language: 'EL' as const, theme: 'dark' as const,
    };
    await saveProfile(profile);
    expect(await loadProfile()).toEqual(profile);
  });
});

// ─── Recipes ─────────────────────────────────────────────────

describe('recipe storage', () => {
  it('prepends newly added recipes ahead of existing ones', async () => {
    await addRecipes([makeRecipe('old')]);
    await addRecipes([makeRecipe('new')]);
    const recipes = await loadRecipes();
    expect(recipes[0].id).toBe('new');
    expect(recipes[1].id).toBe('old');
  });

  it('caps unstarred recipes at 50 but never evicts starred ones', async () => {
    const starred = [makeRecipe('fav-1', true), makeRecipe('fav-2', true), makeRecipe('fav-3', true)];
    await addRecipes(starred);

    // Add 55 unstarred — more than the 50 cap.
    const many = Array.from({ length: 55 }, (_, i) => makeRecipe(`r-${i}`));
    await addRecipes(many);

    const recipes = await loadRecipes();
    const starredCount = recipes.filter(r => r.starred).length;
    const unstarredCount = recipes.filter(r => !r.starred).length;

    expect(starredCount).toBe(3);        // all favorites kept
    expect(unstarredCount).toBe(50);     // unstarred capped
  });
});

// ─── Settings ────────────────────────────────────────────────

describe('settings storage', () => {
  it('returns sensible defaults when nothing is stored', async () => {
    const s = await loadSettings();
    expect(s.apiKey).toBe('');
    expect(s.model).toBe('claude-sonnet-4-5');
  });

  it('round-trips saved settings and migrates invalid Opus id', async () => {
    await saveSettings({ apiKey: 'sk-ant-test', model: 'claude-opus-4-7' as any });
    expect(await loadSettings()).toEqual({ apiKey: 'sk-ant-test', model: 'claude-opus-4-5' });
  });
});

// ─── Reset ───────────────────────────────────────────────────

describe('resetAll', () => {
  it('clears pantry, profile, recipes and settings', async () => {
    await savePantry([makeIngredient('eggs')]);
    await saveSettings({ apiKey: 'sk-ant-test', model: 'claude-haiku-4-5' });
    await addRecipes([makeRecipe('r1')]);

    await resetAll();

    expect(await loadPantry()).toEqual([]);
    expect(await loadRecipes()).toEqual([]);
    expect((await loadSettings()).apiKey).toBe('');
  });
});
