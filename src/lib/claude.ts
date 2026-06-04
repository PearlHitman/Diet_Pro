// Anthropic API integration.
//
// Public API surface — pages import from here and nothing changes for them.
//
// Routing logic:
//   settings.byok === false  →  /api/ai backend proxy  (via backend.ts)
//   settings.byok === true   →  Anthropic SDK directly  (original BYOK flow)
//
// ⚠ Security note (BYOK mode): the API key lives in the user's browser
// storage. We acknowledge this with `dangerouslyAllowBrowser: true`. For
// the proxy mode the key never leaves the server.

import Anthropic from '@anthropic-ai/sdk';
import type { AIResponse, Customization, Ingredient, Language, MealType, Profile, Recipe, Settings, Level } from './types';
import { CATEGORY_SET, isCategory, type Category } from './types';
import { buildProductPhotoPrompt, buildReceiptPrompt, buildRecipePrompt, buildDishPrompt, buildSubstitutionPrompt, RECIPE_SYSTEM_PROMPT, RECIPE_SYSTEM_PROMPT_SPEED, DISH_SYSTEM_PROMPT } from './prompts';
import { pantryMatchesName } from './pantry-match';
import { ClaudeError } from './errors';
import { callBackend } from './backend';

// Re-export so existing importers (NutritionPage etc.) don\'t need updating.
export { ClaudeError };

// Model token strings — keep in sync with src/lib/types.ts ClaudeModel.
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

// ─── Helpers shared by both code paths ───────────────────────

function mapSdkError(e: unknown): never {
  const err = e as { status?: number; message?: string } | null;
  if (err?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
  if (err?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
  if ((err?.status ?? 0) >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
  throw new ClaudeError(err?.message ?? 'Network error', 'network');
}

function requireApiKey(settings: Settings): void {
  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError(
      'No API key set. Go to Settings → Developer and paste your Anthropic API key.',
      'auth',
    );
  }
}

// ─── Generate recipes ─────────────────────────────────────────

export interface GenerateInput {
  pantry: Ingredient[];
  profile: Profile;
  mealType: MealType;
  settings: Settings;
  customization?: Customization;
  /** Free-text craving from "I have a dish in mind" flow. */
  dishIdea?: string;
  maxTime?: number;
  dietary?: string[];
}

export async function generateRecipes(input: GenerateInput): Promise<Recipe[]> {
  const { settings, profile, mealType } = input;
  const fast = settings.recipeSpeed === 'fast';

  const prompt = buildRecipePrompt({
    pantry: input.pantry,
    profile: input.profile,
    mealType: input.mealType,
    customization: input.customization,
    dishIdea: input.dishIdea?.trim() || undefined,
    speed: fast,
    maxTime: input.maxTime,
    dietary: input.dietary,
  });

  let text: string;

  if (settings.byok) {
    // ── BYOK: call Anthropic directly ──
    requireApiKey(settings);
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    try {
      const response = await client.messages.create({
        model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
        max_tokens: fast ? FAST_MAX_TOKENS : BEST_MAX_TOKENS,
        system: fast ? RECIPE_SYSTEM_PROMPT_SPEED : RECIPE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');
      text = block.text;
    } catch (e) {
      if (e instanceof ClaudeError) throw e;
      mapSdkError(e);
    }
  } else {
    // ── Proxy: send pre-built prompt to /api/ai ──
    text = await callBackend({
      action: 'recipes',
      model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
      maxTokens: fast ? FAST_MAX_TOKENS : BEST_MAX_TOKENS,
      system: fast ? RECIPE_SYSTEM_PROMPT_SPEED : RECIPE_SYSTEM_PROMPT,
      prompt,
    });
  }

  const parsed = parseJsonLoose(text);
  if (!isValidAIResponse(parsed, { minRecipes: 1, maxRecipes: 1 })) {
    throw new ClaudeError('Claude returned malformed recipe data.', 'parse');
  }

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

// ─── Generate dish recipe ─────────────────────────────────────

export async function generateDishRecipe(input: {
  dishName: string;
  pantry: Ingredient[];
  profile: Profile;
  settings: Settings;
}): Promise<Recipe> {
  const { dishName, pantry, profile, settings } = input;
  const fast = settings.recipeSpeed === 'fast';

  const prompt = buildDishPrompt(dishName, pantry, profile);
  const systemPrompt = fast
    ? `${RECIPE_SYSTEM_PROMPT_SPEED}\n\n${DISH_SYSTEM_PROMPT}`
    : `${RECIPE_SYSTEM_PROMPT}\n\n${DISH_SYSTEM_PROMPT}`;

  let text: string;

  if (settings.byok) {
    requireApiKey(settings);
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    try {
      const response = await client.messages.create({
        model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
        max_tokens: fast ? DISH_FAST_MAX_TOKENS : BEST_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');
      text = block.text;
    } catch (e) {
      if (e instanceof ClaudeError) throw e;
      mapSdkError(e);
    }
  } else {
    text = await callBackend({
      action: 'dish',
      model: fast ? HAIKU_MODEL : MODEL_ID[settings.model],
      maxTokens: fast ? DISH_FAST_MAX_TOKENS : BEST_MAX_TOKENS,
      system: systemPrompt,
      prompt,
    });
  }

  const parsed = parseJsonLoose(text);
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

  return {
    id: `${Date.now()}-dish`,
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

// ─── Substitutions ────────────────────────────────────────────

export async function suggestSubstitutions(input: {
  missingIngredientNames: string[];
  pantry: Ingredient[];
  settings: Settings;
}): Promise<string> {
  const { missingIngredientNames, pantry, settings } = input;
  const userPrompt = buildSubstitutionPrompt(missingIngredientNames, pantry);

  if (settings.byok) {
    requireApiKey(settings);
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    try {
      const response = await client.messages.create({
        model: MODEL_ID[settings.model],
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');
      return block.text.trim();
    } catch (e) {
      if (e instanceof ClaudeError) throw e;
      mapSdkError(e);
    }
  }

  const text = await callBackend({
    action: 'substitutions',
    model: MODEL_ID[settings.model],
    maxTokens: 1024,
    prompt: userPrompt,
  });
  return text.trim();
}

// ─── Vision helpers ───────────────────────────────────────────

const VISION_MODEL = 'claude-haiku-4-5';
const VISION_MAX_TOKENS = 1024;

function coerceCategory(raw: unknown): Category {
  return isCategory(raw) ? raw : 'other';
}

export interface ScannedIngredient {
  name: string;
  amount?: string;
  category: Category;
}

async function visionCallSdk(
  client: Anthropic,
  prompt: string,
  imageBase64: string,
  mediaType: string,
): Promise<string> {
  try {
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: VISION_MAX_TOKENS,
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
    const block = response.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') throw new ClaudeError('Empty vision response.', 'parse');
    return block.text;
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    mapSdkError(e);
  }
}

export async function scanProductPhoto(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient> {
  const prompt = buildProductPhotoPrompt(language);

  let text: string;
  if (settings.byok) {
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    text = await visionCallSdk(client, prompt, imageBase64, mediaType);
  } else {
    text = await callBackend({ action: 'product-photo', prompt, imageBase64, mediaType, maxTokens: VISION_MAX_TOKENS });
  }

  const parsed = parseJsonLoose(text) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new ClaudeError('Could not identify ingredient from photo.', 'parse');
  }
  const maybe = parsed as { name?: unknown; amount?: unknown; category?: unknown };
  if (typeof maybe.name !== 'string' || !maybe.name.trim()) {
    throw new ClaudeError('Could not identify ingredient from photo.', 'parse');
  }
  return {
    name: maybe.name.trim(),
    amount: typeof maybe.amount === 'string' ? maybe.amount.trim() || undefined : undefined,
    category: coerceCategory(maybe.category),
  };
}

export async function scanReceipt(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient[]> {
  const prompt = buildReceiptPrompt(language);

  let text: string;
  if (settings.byok) {
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    text = await visionCallSdk(client, prompt, imageBase64, mediaType);
  } else {
    text = await callBackend({ action: 'receipt', prompt, imageBase64, mediaType, maxTokens: VISION_MAX_TOKENS });
  }

  const parsed = parseJsonLoose(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { ingredients?: unknown }).ingredients)) {
    throw new ClaudeError('Could not parse receipt.', 'parse');
  }
  const items = (parsed as { ingredients: unknown[] }).ingredients;
  return items
    .filter(i => typeof (i as { name?: unknown }).name === 'string' && String((i as { name?: unknown }).name).trim())
    .map(i => {
      const ing = i as { name: string; amount?: unknown; category?: unknown };
      return {
        name: ing.name.trim(),
        amount: typeof ing.amount === 'string' ? ing.amount.trim() || undefined : undefined,
        category: coerceCategory(ing.category),
      };
    });
}

// ─── Generic text call (used by NutritionPage) ────────────────

/**
 * Minimal wrapper: sends a single user message and returns the text response.
 * Always uses BYOK (direct SDK). NutritionPage is an advanced feature gated
 * behind having an API key.
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
  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') throw new ClaudeError('No text in response.', 'parse');
    return block.text.trim();
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    mapSdkError(e);
  }
}

// ─── API key validation (for Settings) ───────────────────────

export async function validateApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!apiKey.startsWith('sk-ant-')) {
    return { ok: false, reason: 'Key should start with "sk-ant-"' };
  }
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string } | null;
    if (err?.status === 401) return { ok: false, reason: 'Key is invalid or revoked.' };
    return { ok: false, reason: err?.message ?? 'Validation failed.' };
  }
}

// ─── JSON parsing helpers (exported for unit tests) ──────────

export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
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
