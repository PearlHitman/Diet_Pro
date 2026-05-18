// Core data types — the shape of everything stored & passed around.
// Keep this lean. If a field isn't used by UI or AI, don't add it.

// ─── Pantry ──────────────────────────────────────────────────

export type Category =
  | 'produce'       // φρούτα/λαχανικά
  | 'protein'       // κρέας/ψάρι/αυγά
  | 'dairy'         // γαλακτοκομικά
  | 'grains'        // ζυμαρικά/ρύζι/ψωμί
  | 'pantry'        // λάδια, μπαχαρικά, κονσέρβες
  | 'other';

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  // ISO date string (YYYY-MM-DD). null = no expiry tracking.
  expiresOn: string | null;
  // Free text — "500g", "2 cans", "half jar". Optional.
  amount?: string;
  // When was this added? Used for sort order in empty-expiry case.
  addedAt: string; // ISO datetime
}

// ─── Profile ─────────────────────────────────────────────────

export type Level = 'Beginner' | 'Intermediate' | 'Expert';
export type DietGoal = 'None' | 'Weight loss' | 'Muscle' | 'Health';
export type Language = 'EN' | 'EL' | 'ES';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Profile {
  name: string;
  cuisine: string;           // free text, e.g. "Mediterranean"
  servings: number;          // 1-12
  level: Level;
  allergies: string;         // free text, comma-separated
  dietGoal: DietGoal;
  language: Language;
  theme: ThemePref;          // visual theme preference
}

// ─── Recipes ─────────────────────────────────────────────────

export type MealType = 'quick' | 'healthy' | 'comfort' | 'festive';

// ─── Customization ───────────────────────────────────────────
// Per-generation overrides chosen by the user before tapping a meal
// type. Names are lowercased so we can match loosely in the prompt.

export interface Customization {
  mustInclude: string[]; // ingredient names (lowercased) — max 1 protein + 3 other
  skip: string[];        // ingredient names (lowercased) — no cap
}

export const EMPTY_CUSTOMIZATION: Customization = { mustInclude: [], skip: [] };

export interface RecipeIngredient {
  name: string;
  amount: string;            // "200g", "2 cloves", "to taste"
  missing: boolean;          // true = not in user's pantry
}

export interface Recipe {
  id: string;                // generated locally on save
  name: string;
  cookTime: number;          // minutes
  difficulty: Level;
  calories: number;          // estimated per serving
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  // Provenance & user state
  mealType: MealType;
  createdAt: string;         // ISO datetime
  starred: boolean;
}

// ─── Settings ────────────────────────────────────────────────

export type ClaudeModel =
  | 'claude-sonnet-4-5'      // default
  | 'claude-haiku-4-5'
  | 'claude-opus-4-7';

export interface Settings {
  apiKey: string;            // empty string = not configured
  model: ClaudeModel;
}

// ─── AI response shape ───────────────────────────────────────
// What we expect back from Claude. We validate against this before
// trusting it — Claude can drift from schemas under load.

export interface AIRecipe {
  name: string;
  cookTime: number;
  difficulty: Level;
  calories: number;
  ingredients: { name: string; amount: string; missing: boolean }[];
  steps: string[];
}

export interface AIResponse {
  recipes: AIRecipe[];       // expect length === 3
}
