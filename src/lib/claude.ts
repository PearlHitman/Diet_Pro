// Anthropic API integration.
// Browser-direct calls using bring-your-own-key.
//
// ⚠ Security note: the API key lives in the user's browser storage.
// We acknowledge this with `dangerouslyAllowBrowser: true`. For a
// trusted single-user PWA this is acceptable; for a multi-user public
// deployment, you'd want to proxy through a backend instead.

import Anthropic from '@anthropic-ai/sdk';
import type { AIResponse, Customization, Ingredient, Language, MealType, Profile, Recipe, Settings, Level } from './types';
import { CATEGORY_SET, isCategory, type Category } from './types';
import { buildProductPhotoPrompt, buildReceiptPrompt, buildRecipePrompt, buildDishPrompt, buildSubstitutionPrompt, RECIPE_SYSTEM_PROMPT, RECIPE_SYSTEM_PROMPT_SPEED, DISH_SYSTEM_PROMPT } from './prompts';
import { pantryMatchesName } from './pantry-match';

// Model token strings — keep in sync with src/lib/types.ts ClaudeModel.
// The actual API model ID may have a date suffix; we use the canonical
// alias that Anthropic stabilizes.
const MODEL_ID: Record<Settings['model'], string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-haiku-4-5':  'claude-haiku-4-5',
  'claude-opus-4-5':   'claude-opus-4-5',
};

const DIFFICULTIES = new Set<Level>(['Beginner', 'Intermediate', 'Expert']);

const HAIKU_MODEL = 'claude-haiku-4-5';
const BEST_MAX_TOKENS = 3072;
/** Fast mode: one compact recipe. 1536 avoids truncation while staying quick. */
const FAST_MAX_TOKENS = 1536;
/** Single dish in fast mode — one recipe, tighter cap. */
const DISH_FAST_MAX_TOKENS = 1536;

function coerceOptionalPantryCat(raw: unknown): Category | undefined {
  return isCategory(raw) ? raw : undefined;
}

export class ClaudeError extends Error {
  constructor(message: string, public kind: 'auth' | 'rate' | 'network' | 'parse' | 'unknown') {
    super(message);
  }
}

// ─── Generate ────────────────────────────────────────────────

export interface GenerateInput {
  pantry: Ingredient[];
  profile: Profile;
  mealType: MealType;
  settings: Settings;
  customization?: Customization;
  /** Free-text craving from "I have a dish in mind" flow. */
  dishIdea?: string;
}

export async function generateRecipes(input: GenerateInput): Promise<Recipe[]> {
  const { settings, profile, mealType } = input;

  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError(
      'No API key set. Go to Settings and paste your Anthropic API key.',
      'auth',
    );
  }

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const fast = settings.recipeSpeed === 'fast';

  const prompt = buildRecipePrompt({
    pantry: input.pantry,
    profile: input.profile,
    mealType: input.mealType,
    customization: input.customization,
    dishIdea: input.dishIdea?.trim() || undefined,
    speed: fast,
  });

  let response;
  try {
    response = await client.messages.create({
      model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
      max_tokens: fast ? FAST_MAX_TOKENS : BEST_MAX_TOKENS,
      system: fast ? RECIPE_SYSTEM_PROMPT_SPEED : RECIPE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e: any) {
    if (e?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (e?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if (e?.status >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(e?.message ?? 'Network error', 'network');
  }

  // Extract text block.
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeError('No text in Claude response.', 'parse');
  }

  // Parse JSON, tolerating accidental markdown fences.
  const parsed = parseJsonLoose(textBlock.text);
  if (!isValidAIResponse(parsed, { minRecipes: 1, maxRecipes: 1 })) {
    throw new ClaudeError('Claude returned malformed recipe data.', 'parse');
  }

  // Materialize into full Recipe objects.
  const now = new Date().toISOString();
  return parsed.recipes.map((r, i): Recipe => ({
    id: `${Date.now()}-${i}`,
    name: r.name,
    cookTime: r.cookTime,
    difficulty: r.difficulty,
    calories: r.calories,
    servings: profile.servings,
    ingredients: r.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      missing: ing.missing,
      pantryCategory: coerceOptionalPantryCat((ing as { pantryCategory?: unknown }).pantryCategory),
    })),
    steps: r.steps,
    chefTips: Array.isArray(r.chefTips) ? r.chefTips.filter(x => typeof x === 'string' && x.trim()) : [],
    serving: typeof r.serving === 'string' && r.serving.trim()
      ? r.serving.trim()
      : `Serves ${profile.servings}`,
    mealType,
    createdAt: now,
    starred: false,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────

// Exported for unit testing — these guard untrusted AI output, so they're
// the highest-value functions in the file to have test coverage on.
export function parseJsonLoose(text: string): unknown {
  // Strip code fences if Claude added them despite instructions.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last-ditch: find the first { and last } and try that slice.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
    }
    throw new ClaudeError('Could not parse Claude response as JSON.', 'parse');
  }
}

function validIngredient(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  if (typeof i.name !== 'string' || typeof i.amount !== 'string' || typeof i.missing !== 'boolean') return false;
  const pc = i.pantryCategory;
  if (pc !== undefined && !CATEGORY_SET.has(pc as Category)) return false;
  return true;
}

// Optional bounds support future "one quick idea" (1 recipe) vs full runs (3).
export function isValidAIResponse(
  x: unknown,
  opts?: { minRecipes?: number; maxRecipes?: number },
): x is AIResponse {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  if (!Array.isArray(obj.recipes)) return false;
  const count = obj.recipes.length;
  const minRecipes = opts?.minRecipes ?? 1;
  if (count < minRecipes) return false;
  if (opts?.maxRecipes !== undefined && count > opts.maxRecipes) return false;
  return obj.recipes.every((r: unknown) => {
    if (!r || typeof r !== 'object') return false;
    const rr = r as Record<string, unknown>;
    const tipsOk = rr.chefTips === undefined
      || (Array.isArray(rr.chefTips) && rr.chefTips.every(t => typeof t === 'string'));
    const servingsOk = rr.serving === undefined || typeof rr.serving === 'string';
    return (
      typeof rr.name === 'string' &&
      typeof rr.cookTime === 'number' &&
      DIFFICULTIES.has(rr.difficulty as Level) &&
      typeof rr.calories === 'number' &&
      Array.isArray(rr.ingredients) &&
      rr.ingredients.every(validIngredient) &&
      Array.isArray(rr.steps) &&
      rr.steps.length > 0 &&
      tipsOk &&
      servingsOk
    );
  });
}

export function isValidAIDishResponse(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const rec = (x as Record<string, unknown>).recipe;
  if (!rec || typeof rec !== 'object') return false;
  const rr = rec as Record<string, unknown>;
  const tipsOk = rr.chefTips === undefined
    || (Array.isArray(rr.chefTips) && rr.chefTips.every(t => typeof t === 'string'));
  const servingsOk = rr.serving === undefined || typeof rr.serving === 'string';
  return (
    typeof rr.name === 'string' &&
    typeof rr.cookTime === 'number' &&
    DIFFICULTIES.has(rr.difficulty as Level) &&
    typeof rr.calories === 'number' &&
    Array.isArray(rr.ingredients) &&
    rr.ingredients.every(validIngredient) &&
    Array.isArray(rr.steps) &&
    rr.steps.length > 0 &&
    tipsOk &&
    servingsOk
  );
}

export async function generateDishRecipe(input: {
  dishName: string;
  pantry: Ingredient[];
  profile: Profile;
  settings: Settings;
}): Promise<Recipe> {
  const { dishName, pantry, profile, settings } = input;

  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError(
      'No API key set. Go to Settings and paste your Anthropic API key.',
      'auth',
    );
  }

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = buildDishPrompt(dishName, pantry, profile);
  const fast = settings.recipeSpeed === 'fast';

  let response;
  try {
    response = await client.messages.create({
      model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
      max_tokens: fast ? DISH_FAST_MAX_TOKENS : BEST_MAX_TOKENS,
      system: fast
        ? `${RECIPE_SYSTEM_PROMPT_SPEED}\n\n${DISH_SYSTEM_PROMPT}`
        : `${RECIPE_SYSTEM_PROMPT}\n\n${DISH_SYSTEM_PROMPT}`,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e: any) {
    if (e?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (e?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if (e?.status >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(e?.message ?? 'Network error', 'network');
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeError('No text in Claude response.', 'parse');
  }

  const parsed = parseJsonLoose(textBlock.text);
  if (!isValidAIDishResponse(parsed)) {
    throw new ClaudeError('Claude returned malformed recipe data.', 'parse');
  }

  const raw = parsed as { recipe: {
    name: string;
    cookTime: number;
    difficulty: Level;
    calories: number;
    ingredients: { name: string; amount: string; missing: boolean; pantryCategory?: unknown }[];
    steps: string[];
    chefTips?: string[];
    serving?: string;
  } };

  const ai = raw.recipe;
  const now = new Date().toISOString();
  const id = `${Date.now()}-dish`;

  return {
    id,
    name: ai.name,
    cookTime: ai.cookTime,
    difficulty: ai.difficulty,
    calories: ai.calories,
    servings: profile.servings,
    ingredients: ai.ingredients.map(ing => {
      const has = pantryMatchesName(pantry, ing.name);
      const cat = coerceOptionalPantryCat(ing.pantryCategory);
      return {
        name: ing.name,
        amount: ing.amount,
        missing: !has,
        pantryCategory: !has ? (cat ?? 'other') : undefined,
      };
    }),
    steps: ai.steps,
    chefTips: Array.isArray(ai.chefTips)
      ? ai.chefTips.filter(x => typeof x === 'string' && x.trim())
      : [],
    serving: typeof ai.serving === 'string' && ai.serving.trim()
      ? ai.serving.trim()
      : `Serves ${profile.servings}`,
    mealType: 'comfort',
    createdAt: now,
    starred: false,
  };
}

export async function suggestSubstitutions(input: {
  missingIngredientNames: string[];
  pantry: Ingredient[];
  settings: Settings;
}): Promise<string> {
  const { missingIngredientNames, pantry, settings } = input;

  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError(
      'No API key set. Go to Settings and paste your Anthropic API key.',
      'auth',
    );
  }

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const user = buildSubstitutionPrompt(missingIngredientNames, pantry);

  let response;
  try {
    response = await client.messages.create({
      model: MODEL_ID[settings.model],
      max_tokens: 1024,
      messages: [{ role: 'user', content: user }],
    });
  } catch (e: any) {
    if (e?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (e?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if (e?.status >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(e?.message ?? 'Network error', 'network');
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeError('No text in Claude response.', 'parse');
  }
  return textBlock.text.trim();
}

// ─── Vision helpers ───────────────────────────────────────────

// Haiku is always used for vision calls — cheaper and fast enough.
const VISION_MODEL = 'claude-haiku-4-5';

function coerceCategory(raw: unknown): Category {
  return isCategory(raw) ? raw : 'other';
}

export interface ScannedIngredient {
  name: string;
  amount?: string;
  category: Category;
}

function makeClient(settings: Settings): Anthropic {
  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError('No API key set. Go to Settings and paste your Anthropic API key.', 'auth');
  }
  return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
}

async function visionCall(
  client: Anthropic,
  prompt: string,
  imageBase64: string,
  mediaType: string,
): Promise<string> {
  let response;
  try {
    response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });
  } catch (e: any) {
    if (e?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (e?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    throw new ClaudeError(e?.message ?? 'Network error', 'network');
  }
  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new ClaudeError('Empty vision response.', 'parse');
  return block.text;
}

// Single product photo → one ingredient.
export async function scanProductPhoto(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient> {
  const client = makeClient(settings);
  const text = await visionCall(client, buildProductPhotoPrompt(language), imageBase64, mediaType);
  const parsed = parseJsonLoose(text) as any;
  if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) {
    throw new ClaudeError('Could not identify ingredient from photo.', 'parse');
  }
  return {
    name: parsed.name.trim(),
    amount: typeof parsed.amount === 'string' ? parsed.amount.trim() || undefined : undefined,
    category: coerceCategory(parsed.category),
  };
}

// Receipt photo → list of ingredients.
export async function scanReceipt(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient[]> {
  const client = makeClient(settings);
  const text = await visionCall(client, buildReceiptPrompt(language), imageBase64, mediaType);
  const parsed = parseJsonLoose(text) as any;
  if (!parsed || !Array.isArray(parsed.ingredients)) {
    throw new ClaudeError('Could not parse receipt.', 'parse');
  }
  return (parsed.ingredients as any[])
    .filter(i => typeof i?.name === 'string' && i.name.trim())
    .map(i => ({
      name: i.name.trim(),
      amount: typeof i.amount === 'string' ? i.amount.trim() || undefined : undefined,
      category: coerceCategory(i.category),
    }));
}

// ─── Generic text call (used by nutrition estimator) ─────────

/**
 * Minimal wrapper: sends a single user message and returns the text response.
 * Uses Haiku by default for speed and cost.
 */
export async function callClaude({
  apiKey,
  model = 'claude-haiku-4-5',
  prompt,
  system,
  maxTokens = 256,
}: {
  apiKey: string;
  model?: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  if (!apiKey) throw new ClaudeError('No API key set.', 'auth');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e: any) {
    if (e?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (e?.status === 429) throw new ClaudeError('Rate limit hit.', 'rate');
    throw new ClaudeError(e?.message ?? 'Network error', 'network');
  }
  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new ClaudeError('No text in response.', 'parse');
  return block.text.trim();
}

// ─── API key validation (for Settings) ───────────────────────

export async function validateApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!apiKey.startsWith('sk-ant-')) {
    return { ok: false, reason: 'Key should start with "sk-ant-"' };
  }
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    // Cheapest possible call: 1 token, Haiku.
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.status === 401) return { ok: false, reason: 'Key is invalid or revoked.' };
    return { ok: false, reason: e?.message ?? 'Validation failed.' };
  }
}
