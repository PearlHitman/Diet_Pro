// Core data types -- the shape of everything stored & passed around.

// ---- Pantry ----

export const CATEGORIES = [
  'produce',
  'protein',
  'dairy',
  'grains',
  'pantry',
  'other',
] as const;

export type Category = typeof CATEGORIES[number];

export const CATEGORY_SET: ReadonlySet<Category> = new Set(CATEGORIES);

export function isCategory(x: unknown): x is Category {
  return typeof x === 'string' && CATEGORY_SET.has(x as Category);
}

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  expiresOn: string | null;
  amount?: string;
  addedAt: string;
}

// ---- Profile ----

export type Level = 'Beginner' | 'Intermediate' | 'Expert';
export type DietGoal = 'None' | 'Weight loss' | 'Muscle' | 'Health';
export type Language = 'EN' | 'EL' | 'ES';
export type ThemePref = 'system' | 'light' | 'dark';
export type TonePref = 'warm-dark' | 'slate-dark' | 'espresso' | 'editorial-cream';

export interface Profile {
  name: string;
  cuisine: string;
  servings: number;
  level: Level;
  allergies: string;
  dietGoal: DietGoal;
  language: Language;
  theme: ThemePref;
  tone?: TonePref;
  autoColor?: boolean;
  manualColor?: string;
}

// ---- Recipes ----

export type MealType = 'quick' | 'healthy' | 'comfort' | 'festive';

// ---- Customization ----

export interface Customization {
  mustInclude: string[];
  skip: string[];
}

export const EMPTY_CUSTOMIZATION: Customization = { mustInclude: [], skip: [] };

export interface RecipeIngredient {
  name: string;
  amount: string;
  missing: boolean;
  pantryCategory?: Category;
}

export interface Recipe {
  id: string;
  name: string;
  cookTime: number;
  difficulty: Level;
  calories: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  chefTips: string[];
  serving: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType: MealType;
  createdAt: string;
  starred: boolean;
}

// ---- Body stats & nutrition ----

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface BodyStats {
  sex: Sex;
  age: number;
  weight: number;
  height: number;
  activityLevel: ActivityLevel;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface LoggedMeal {
  id: string;
  date: string;
  name: string;
  source: 'recipe' | 'manual';
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
}

// ---- Settings ----

export type ClaudeModel =
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5'
  | 'claude-opus-4-5';

export type RecipeSpeed = 'fast' | 'best';

export interface Settings {
  apiKey: string;
  model: ClaudeModel;
  recipeSpeed: RecipeSpeed;
  byok: boolean;
}

// ---- AI response shape ----

export interface AIRecipe {
  name: string;
  cookTime: number;
  difficulty: Level;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients: { name: string; amount: string; missing: boolean; pantryCategory?: Category }[];
  steps: string[];
  chefTips?: string[];
  serving?: string;
}

export interface AIResponse {
  recipes: AIRecipe[];
}

export interface AIDishResponse {
  recipe: AIRecipe;
}

// ---- Promo codes ----

export interface PromoRecord {
  code: string;
  activatedAt: string; // ISO date string
}

export interface PromoStatus {
  active: boolean;
  code?: string;
  activatedAt?: string;       // ISO date string
  gracePeriodEnds?: string;   // activatedAt + 5 days
  expiresAt?: string;         // activatedAt + 90 days
  dailyLimit: number;         // 20 during promo, 3 default
  inGracePeriod: boolean;     // true if within first 5 days
  daysRemaining?: number;     // days left in the 90-day promo
  expired?: boolean;          // true if promo window has ended
}

// ---- Meal Plan ----

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMeal {
  id: string;            // uid
  slot: MealSlot;
  name: string;
  calories: number;
  protein: number;       // grams per serving
  carbs: number;         // grams per serving
  fat: number;           // grams per serving
  servings: number;
  ingredients: { name: string; amount: string; category: Category }[];
  cooked: boolean;       // true once user marks it done
}

export interface MealPlanDay {
  date: string;          // YYYY-MM-DD
  meals: PlannedMeal[];
}

export interface WeekMealPlan {
  id: string;
  createdAt: string;     // ISO datetime
  startDate: string;     // YYYY-MM-DD (Monday of the week)
  days: MealPlanDay[];   // always 7 entries
}

export interface GroceryItem {
  name: string;
  totalAmount: string;   // consolidated e.g. "600g" or "× 4"
  category: Category;
  checked: boolean;
}
