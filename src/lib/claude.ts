// Anthropic API integration.
// Browser-direct calls using bring-your-own-key.
//
// ⚠ Security note: the API key lives in the user's browser storage.
// We acknowledge this with `dangerouslyAllowBrowser: true`. For a
// trusted single-user PWA this is acceptable; for a multi-user public
// deployment, you'd want to proxy through a backend instead.

import Anthropic from '@anthropic-ai/sdk';
import type { AIResponse, Ingredient, MealType, Profile, Recipe, Settings } from './types';
import { buildRecipePrompt } from './prompts';

// Model token strings — keep in sync with src/lib/types.ts ClaudeModel.
// The actual API model ID may have a date suffix; we use the canonical
// alias that Anthropic stabilizes.
const MODEL_ID: Record<Settings['model'], string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-haiku-4-5':  'claude-haiku-4-5',
  'claude-opus-4-7':   'claude-opus-4-7',
};

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

  const prompt = buildRecipePrompt(input);

  let response;
  try {
    response = await client.messages.create({
      model: MODEL_ID[settings.model],
      max_tokens: 4096,
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
  if (!isValidAIResponse(parsed)) {
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
    ingredients: r.ingredients,
    steps: r.steps,
    mealType,
    createdAt: now,
    starred: false,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────

function parseJsonLoose(text: string): unknown {
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

function isValidAIResponse(x: unknown): x is AIResponse {
  if (!x || typeof x !== 'object') return false;
  const obj = x as any;
  if (!Array.isArray(obj.recipes) || obj.recipes.length === 0) return false;
  return obj.recipes.every((r: any) =>
    typeof r?.name === 'string' &&
    typeof r?.cookTime === 'number' &&
    typeof r?.calories === 'number' &&
    Array.isArray(r?.ingredients) &&
    Array.isArray(r?.steps) &&
    r.steps.length > 0,
  );
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
