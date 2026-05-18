// Core data types — the shape of everything stored & passed around.
// Keep this lean. If a field isn't used by UI or AI, don't add it.

// ─── Pantry ──────────────────────────────────────────────────

// Canonical ordering of pantry categories. Imported everywhere instead
// of being retyped locally (it had drifted into two different orders
// across the codebase before being centralised here).
export const CATEGORIES = [
  'produce', // φρούτα/λαχανικά
  'protein', // κρέας/ψάρι/αυγά
  'dairy',   // γαλακτοκομικά
  'grains',  // ζυμαρικά/ρύζι/ψωμί
  'pantry',  // λάδια, μπαχαρικά, κονσέρβες
  'other',
] as const;

export type Category = typeof CATEGORIES[number];

/** Set form for fast membership/validation checks. */
export const CATEGORY_SET: ReadonlySet<Category> = new Set(CATEGORIES);

/** Type guard for unknown values coming off the wire / from storage. */
export function isCategory(x: unknown): x is Category {
  return typeof x === 'string' && CATEGORY_SET.has(x as Category);
}

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
  /** Shopping-list grouping when missing (from AI hint). */
  pantryCategory?: Category;
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
  chefTips: string[];
  /** Human-readable portion line, e.g. "Serves 4". */
  serving: string;
  // Provenance & user state
  mealType: MealType;
  createdAt: string;         // ISO datetime
  starred: boolean;
}

// ─── Settings ────────────────────────────────────────────────

export type ClaudeModel =
  | 'claude-sonnet-4-5'      // default
  | 'claude-haiku-4-5'
  | 'claude-opus-4-5';

/** Recipe batch generation profile — separate from `model` (used for subs etc.). */
export type RecipeSpeed = 'fast' | 'best';

export interface Settings {
  apiKey: string;            // empty string = not configured
  model: ClaudeModel;
  /** Fast = Haiku + 2 compact recipes; Best = chosen model + 3 full recipes. */
  recipeSpeed: RecipeSpeed;
}

// ─── AI response shape ─────────────────────────────────────

export interface AIRecipe {
  name: string;
  cookTime: number;
  difficulty: Level;
  calories: number;
  ingredients: { name: string; amount: string; missing: boolean; pantryCategory?: Category }[];
  steps: string[];
  chefTips?: string[];
  serving?: string;
}

export interface AIResponse {
  recipes: AIRecipe[];       // 2 in fast mode, 3 in best mode
}

export interface AIDishResponse {
  recipe: AIRecipe;
}
