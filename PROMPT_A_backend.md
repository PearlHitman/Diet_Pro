# Prompt A — Backend Proxy + BYOK Toggle
> Paste this entire prompt into Cursor Composer (Composer 2.5, Agent mode).
> Do NOT run it in Chat mode — it needs file-write access.

---

## Context

Re-read `CURSOR.md` before making any changes. The entire prompt below is an
intentional, pre-approved architectural override of the "Don't proxy the
Anthropic API through a server" rule in CURSOR.md. Every other convention
(inline styles, CSS vars, `useApp()` for storage, `t()` for strings, etc.)
still applies.

---

## Goal

Wire Mise to a Vercel backend proxy so friends can use the app without
supplying an API key. My Anthropic key lives in Vercel's environment.
Upstash Redis enforces a hard limit of **3 AI generations per device per day**.
A hidden "Developer" toggle in Settings lets me flip back to direct
browser→Anthropic calls (BYOK mode) for my own use.

**No page-level components should need to change.** All routing logic
lives in `src/lib/claude.ts` and the new `src/lib/backend.ts`.

---

## Step 1 — Install packages

Run this in the terminal (from the `kitchen-assistant/` folder):

```bash
npm install @upstash/redis @upstash/ratelimit
```

---

## Step 2 — Environment variable template

Create a new file `.env.example` in the project root with this exact content:

```
# Copy to .env.local for local dev (never commit .env.local)

# Your Anthropic API key — lives only on the server, never in the browser
ANTHROPIC_API_KEY=sk-ant-...

# Upstash Redis — get these from console.upstash.com after creating a database
UPSTASH_REDIS_REST_URL=https://YOUR-DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN_HERE
```

Also add `.env.local` to `.gitignore` if it isn't there already.

---

## Step 3 — Update `vercel.json`

Replace the entire contents of `vercel.json` with:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This is unchanged — Vercel automatically routes any file under `api/` as a
serverless function *before* the SPA catch-all applies, so no extra config
is needed.

---

## Step 4 — Create the Vercel serverless function `api/ai.ts`

Create a new file `api/ai.ts` with the following content.

> IMPORTANT: This file runs on Node.js on Vercel's servers. It must not import
> anything from `src/` that uses browser-only APIs (window, localStorage, etc.).
> The imports from `src/lib/prompts.ts` and `src/lib/types.ts` are fine —
> they are pure TypeScript with no browser dependencies.

```typescript
// api/ai.ts — Vercel serverless function
// Proxies all AI calls to Anthropic on behalf of the client.
// Rate-limits by anonymous device ID using Upstash Redis.
//
// Environment variables required (set in Vercel dashboard):
//   ANTHROPIC_API_KEY
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Anthropic client (server-side — no dangerouslyAllowBrowser) ─────────────
function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured on server.');
  return new Anthropic({ apiKey: key });
}

// ─── Rate limiter — 3 generations per device per calendar day ────────────────
// Uses Upstash fixed-window limiter. The window resets at UTC midnight.
// Each action that calls the Anthropic AI counts as 1 generation.
// Quota-check and validate-key do NOT count.
function getRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(3, '1 d'),
    analytics: false,
    prefix: 'mise_quota',
  });
}

// ─── CORS headers (allow the Vercel deployment + localhost dev) ───────────────
function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id');
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as Record<string, unknown>;
  const action = body?.action as string | undefined;
  const deviceId = (req.headers['x-device-id'] as string | undefined) ?? 'unknown';

  // ── Quota check (does NOT consume a generation) ──────────────────────────
  if (action === 'quota') {
    try {
      const limiter = getRateLimiter();
      // Peek without consuming: pass a dummy identifier we won't increment.
      // We use the real deviceId but with limit check only (no consume).
      // @upstash/ratelimit doesn't have a native "peek" but we can check
      // remaining by calling limit() on a throwaway key. Instead, use the
      // Upstash Redis client directly to read the current count.
      const redis = Redis.fromEnv();
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `mise_quota:fixed:${deviceId}:${today}`;
      const count = (await redis.get<number>(key)) ?? 0;
      return res.status(200).json({ used: count, limit: 3, remaining: Math.max(0, 3 - count) });
    } catch (e) {
      // If Redis is unreachable, report full quota to fail open (not block the user).
      return res.status(200).json({ used: 0, limit: 3, remaining: 3 });
    }
  }

  // ── All generation actions: enforce rate limit first ─────────────────────
  const GENERATION_ACTIONS = ['recipes', 'dish', 'substitutions', 'product-photo', 'receipt'];
  if (GENERATION_ACTIONS.includes(action ?? '')) {
    try {
      const limiter = getRateLimiter();
      const { success, remaining } = await limiter.limit(deviceId);
      if (!success) {
        return res.status(429).json({
          error: 'quota_exceeded',
          message: "You've used all 3 free recipes for today. Come back tomorrow — your quota resets at midnight UTC.",
          remaining: 0,
        });
      }
      res.setHeader('X-Quota-Remaining', String(remaining));
    } catch (e) {
      // If Redis is unavailable, fail open (allow the request through).
      // This prevents an Upstash outage from blocking all users.
      console.warn('[mise] Rate limiter unavailable, failing open:', e);
    }
  }

  // ── Dispatch to action handlers ───────────────────────────────────────────
  try {
    const client = getAnthropicClient();

    switch (action) {
      case 'recipes':      return await handleRecipes(req, res, client, body);
      case 'dish':         return await handleDish(req, res, client, body);
      case 'substitutions':return await handleSubstitutions(req, res, client, body);
      case 'product-photo':return await handleProductPhoto(req, res, client, body);
      case 'receipt':      return await handleReceipt(req, res, client, body);
      default:
        return res.status(400).json({ error: 'Unknown action: ' + String(action) });
    }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) {
      return res.status(429).json({ error: 'rate_limit', message: 'Anthropic rate limit reached. Try again in a moment.' });
    }
    if (err?.status === 401) {
      return res.status(500).json({ error: 'server_config', message: 'Server API key error. Please contact support.' });
    }
    console.error('[mise] Unhandled error:', e);
    return res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  }
}

// ─── Action: generate recipes ─────────────────────────────────────────────────
async function handleRecipes(
  _req: VercelRequest,
  res: VercelResponse,
  client: Anthropic,
  body: Record<string, unknown>,
) {
  // Import prompt builders — pure TypeScript, no browser APIs.
  const { buildRecipePrompt, RECIPE_SYSTEM_PROMPT, RECIPE_SYSTEM_PROMPT_SPEED } = await import('../src/lib/prompts.js');

  const { pantry, profile, mealType, customization, dishIdea, fast } = body as {
    pantry: unknown; profile: unknown; mealType: unknown;
    customization?: unknown; dishIdea?: string; fast?: boolean;
  };

  const HAIKU = 'claude-haiku-4-5';
  const SONNET = 'claude-sonnet-4-5';

  const prompt = buildRecipePrompt({
    pantry: pantry as Parameters<typeof buildRecipePrompt>[0]['pantry'],
    profile: profile as Parameters<typeof buildRecipePrompt>[0]['profile'],
    mealType: mealType as Parameters<typeof buildRecipePrompt>[0]['mealType'],
    customization: customization as Parameters<typeof buildRecipePrompt>[0]['customization'],
    dishIdea: typeof dishIdea === 'string' ? dishIdea.trim() || undefined : undefined,
    speed: !!fast,
  });

  const response = await client.messages.create({
    model: fast ? HAIKU : SONNET,
    max_tokens: fast ? 1536 : 3072,
    system: fast ? RECIPE_SYSTEM_PROMPT_SPEED : RECIPE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = extractText(response);
  return res.status(200).json({ text });
}

// ─── Action: generate dish recipe ─────────────────────────────────────────────
async function handleDish(
  _req: VercelRequest,
  res: VercelResponse,
  client: Anthropic,
  body: Record<string, unknown>,
) {
  const { buildDishPrompt, RECIPE_SYSTEM_PROMPT, RECIPE_SYSTEM_PROMPT_SPEED, DISH_SYSTEM_PROMPT } = await import('../src/lib/prompts.js');

  const { dishName, pantry, profile, fast } = body as {
    dishName: string; pantry: unknown; profile: unknown; fast?: boolean;
  };

  const HAIKU = 'claude-haiku-4-5';
  const SONNET = 'claude-sonnet-4-5';

  const prompt = buildDishPrompt(
    dishName,
    pantry as Parameters<typeof buildDishPrompt>[1],
    profile as Parameters<typeof buildDishPrompt>[2],
  );

  const system = fast
    ? `${RECIPE_SYSTEM_PROMPT_SPEED}\n\n${DISH_SYSTEM_PROMPT}`
    : `${RECIPE_SYSTEM_PROMPT}\n\n${DISH_SYSTEM_PROMPT}`;

  const response = await client.messages.create({
    model: fast ? HAIKU : SONNET,
    max_tokens: fast ? 1536 : 3072,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = extractText(response);
  return res.status(200).json({ text });
}

// ─── Action: substitutions ────────────────────────────────────────────────────
async function handleSubstitutions(
  _req: VercelRequest,
  res: VercelResponse,
  client: Anthropic,
  body: Record<string, unknown>,
) {
  const { buildSubstitutionPrompt } = await import('../src/lib/prompts.js');

  const { missingIngredientNames, pantry, model } = body as {
    missingIngredientNames: string[];
    pantry: unknown;
    model?: string;
  };

  const safeModel = (['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5'] as const)
    .includes(model as 'claude-haiku-4-5') ? model! : 'claude-sonnet-4-5';

  const prompt = buildSubstitutionPrompt(
    missingIngredientNames,
    pantry as Parameters<typeof buildSubstitutionPrompt>[1],
  );

  const response = await client.messages.create({
    model: safeModel,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = extractText(response);
  return res.status(200).json({ text });
}

// ─── Action: product photo ────────────────────────────────────────────────────
async function handleProductPhoto(
  _req: VercelRequest,
  res: VercelResponse,
  client: Anthropic,
  body: Record<string, unknown>,
) {
  const { buildProductPhotoPrompt } = await import('../src/lib/prompts.js');
  const { imageBase64, mediaType, language } = body as {
    imageBase64: string; mediaType: string; language: string;
  };

  const prompt = buildProductPhotoPrompt(language as 'EN' | 'EL' | 'ES');
  const text = await visionCall(client, prompt, imageBase64, mediaType);
  return res.status(200).json({ text });
}

// ─── Action: receipt scan ─────────────────────────────────────────────────────
async function handleReceipt(
  _req: VercelRequest,
  res: VercelResponse,
  client: Anthropic,
  body: Record<string, unknown>,
) {
  const { buildReceiptPrompt } = await import('../src/lib/prompts.js');
  const { imageBase64, mediaType, language } = body as {
    imageBase64: string; mediaType: string; language: string;
  };

  const prompt = buildReceiptPrompt(language as 'EN' | 'EL' | 'ES');
  const text = await visionCall(client, prompt, imageBase64, mediaType);
  return res.status(200).json({ text });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text in Anthropic response.');
  return block.text;
}

async function visionCall(
  client: Anthropic,
  prompt: string,
  imageBase64: string,
  mediaType: string,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
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
  return extractText(response);
}
```

---

## Step 5 — Install `@vercel/node` types

Run:

```bash
npm install --save-dev @vercel/node
```

---

## Step 6 — Create `src/lib/device-id.ts`

This module generates a stable anonymous ID for the device on first launch
and stores it in IndexedDB alongside the rest of the app data.

```typescript
// src/lib/device-id.ts
// Generates and persists a stable anonymous device identifier.
// Used as the rate-limit key on the backend (no personal data).
// Stored in IndexedDB — survives app reinstalls unless the user clears
// browser data.

import { get, set } from 'idb-keyval';

const DEVICE_ID_KEY = 'mise:deviceId:v1';

function generateId(): string {
  // crypto.randomUUID() is available in all modern browsers and Node 19+.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let _cached: string | null = null;

/**
 * Returns the device ID, creating and persisting one on first call.
 * Subsequent calls within the same session use an in-memory cache.
 */
export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;
  const stored = await get<string>(DEVICE_ID_KEY);
  if (stored) {
    _cached = stored;
    return stored;
  }
  const newId = generateId();
  await set(DEVICE_ID_KEY, newId);
  _cached = newId;
  return newId;
}
```

---

## Step 7 — Update `src/lib/types.ts`

In the `Settings` interface, add a `byok` field after `recipeSpeed`:

```typescript
export interface Settings {
  apiKey: string;            // empty string = not configured
  model: ClaudeModel;
  /** Fast = Haiku + 2 compact recipes; Best = chosen model + 3 full recipes. */
  recipeSpeed: RecipeSpeed;
  /** true = bypass the proxy and call Anthropic directly (power-user mode). */
  byok: boolean;
}
```

---

## Step 8 — Update `src/lib/db.ts`

**8a.** Update `DEFAULT_SETTINGS` to include `byok: false`:

```typescript
const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-5',
  recipeSpeed: 'best',
  byok: false,
};
```

**8b.** In `loadSettings()`, add `byok` coercion so old saved settings
(which won't have this field) safely default to `false`. Change the return
statement of `loadSettings` to:

```typescript
export async function loadSettings(): Promise<Settings> {
  const saved = await get<Partial<Settings>>(K.settings);
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    model: coerceLoadedModel(saved),
    recipeSpeed: coerceLoadedRecipeSpeed(saved),
    byok: typeof saved?.byok === 'boolean' ? saved.byok : false,
  };
}
```

---

## Step 9 — Create `src/lib/backend.ts`

This is the frontend proxy client. It mirrors the function signatures of
`claude.ts` but sends requests to `/api/ai` instead of calling Anthropic
directly. Pages never import this file — `claude.ts` calls it internally.

```typescript
// src/lib/backend.ts
// Proxy client — sends AI requests to the Vercel backend.
// All functions mirror the signatures in claude.ts so the caller
// (claude.ts) can swap between modes with no changes to pages.

import type { GenerateInput } from './claude';
import type { Ingredient, Language, Profile, Recipe, Settings } from './types';
import { getDeviceId } from './device-id';
import { ClaudeError, parseJsonLoose, isValidAIResponse, isValidAIDishResponse } from './claude';
import type { ScannedIngredient } from './claude';
import type { Level } from './types';
import { pantryMatchesName } from './pantry-match';
import { isCategory } from './types';
import type { Category } from './types';

const API_BASE = '/api/ai';

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function proxyCall(action: string, payload: Record<string, unknown>): Promise<string> {
  const deviceId = await getDeviceId();
  let response: Response;
  try {
    response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new ClaudeError('Network error — check your connection.', 'network');
  }

  if (response.status === 429) {
    let msg = 'quota_exceeded';
    try {
      const data = await response.json() as { error?: string; message?: string };
      if (data.error === 'quota_exceeded') {
        throw new ClaudeError(
          data.message ?? "You've used all 3 free recipes for today. Come back tomorrow!",
          'quota' as 'rate',
        );
      }
      msg = data.message ?? msg;
    } catch (inner) {
      if (inner instanceof ClaudeError) throw inner;
    }
    throw new ClaudeError(msg, 'rate');
  }

  if (!response.ok) {
    let serverMsg = `Server error (${response.status})`;
    try {
      const data = await response.json() as { message?: string };
      if (data.message) serverMsg = data.message;
    } catch { /* ignore */ }
    throw new ClaudeError(serverMsg, 'network');
  }

  const data = await response.json() as { text?: string };
  if (typeof data.text !== 'string') {
    throw new ClaudeError('Unexpected response from server.', 'parse');
  }
  return data.text;
}

// ─── Generate recipes ─────────────────────────────────────────────────────────

export async function backendGenerateRecipes(input: GenerateInput): Promise<Recipe[]> {
  const { pantry, profile, mealType, customization, dishIdea, settings } = input;
  const fast = settings.recipeSpeed === 'fast';

  const text = await proxyCall('recipes', { pantry, profile, mealType, customization, dishIdea, fast });

  const parsed = parseJsonLoose(text);
  if (!isValidAIResponse(parsed, { minRecipes: 1, maxRecipes: 1 })) {
    throw new ClaudeError('Server returned malformed recipe data.', 'parse');
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
      pantryCategory: isCategory((ing as { pantryCategory?: unknown }).pantryCategory)
        ? (ing as { pantryCategory?: unknown }).pantryCategory as Category
        : undefined,
    })),
    steps: r.steps,
    chefTips: Array.isArray(r.chefTips) ? r.chefTips.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [],
    serving: typeof r.serving === 'string' && r.serving.trim()
      ? r.serving.trim()
      : `Serves ${profile.servings}`,
    mealType,
    createdAt: now,
    starred: false,
  }));
}

// ─── Generate dish recipe ─────────────────────────────────────────────────────

export async function backendGenerateDishRecipe(input: {
  dishName: string;
  pantry: Ingredient[];
  profile: Profile;
  settings: Settings;
}): Promise<Recipe> {
  const { dishName, pantry, profile, settings } = input;
  const fast = settings.recipeSpeed === 'fast';

  const text = await proxyCall('dish', { dishName, pantry, profile, fast });

  const parsed = parseJsonLoose(text);
  if (!isValidAIDishResponse(parsed)) {
    throw new ClaudeError('Server returned malformed dish data.', 'parse');
  }

  const raw = parsed as {
    recipe: {
      name: string; cookTime: number; difficulty: Level; calories: number;
      ingredients: { name: string; amount: string; missing: boolean; pantryCategory?: unknown }[];
      steps: string[]; chefTips?: string[]; serving?: string;
    }
  };

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
      return {
        name: ing.name,
        amount: ing.amount,
        missing: !has,
        pantryCategory: !has
          ? (isCategory(ing.pantryCategory) ? ing.pantryCategory : 'other')
          : undefined,
      };
    }),
    steps: ai.steps,
    chefTips: Array.isArray(ai.chefTips)
      ? ai.chefTips.filter((x): x is string => typeof x === 'string' && !!x.trim())
      : [],
    serving: typeof ai.serving === 'string' && ai.serving.trim()
      ? ai.serving.trim()
      : `Serves ${profile.servings}`,
    mealType: 'comfort',
    createdAt: now,
    starred: false,
  };
}

// ─── Substitutions ────────────────────────────────────────────────────────────

export async function backendSuggestSubstitutions(input: {
  missingIngredientNames: string[];
  pantry: Ingredient[];
  settings: Settings;
}): Promise<string> {
  const { missingIngredientNames, pantry, settings } = input;
  return proxyCall('substitutions', { missingIngredientNames, pantry, model: settings.model });
}

// ─── Product photo ────────────────────────────────────────────────────────────

export async function backendScanProductPhoto(
  imageBase64: string,
  mediaType: string,
  language: Language,
): Promise<ScannedIngredient> {
  const text = await proxyCall('product-photo', { imageBase64, mediaType, language });
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
    category: isCategory(maybe.category) ? maybe.category : 'other',
  };
}

// ─── Receipt scan ─────────────────────────────────────────────────────────────

export async function backendScanReceipt(
  imageBase64: string,
  mediaType: string,
  language: Language,
): Promise<ScannedIngredient[]> {
  const text = await proxyCall('receipt', { imageBase64, mediaType, language });
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
        category: isCategory(ing.category) ? ing.category : 'other',
      };
    });
}
```

---

## Step 10 — Update `src/lib/claude.ts`

### 10a — Add `'quota'` to `ClaudeError` kinds

In the `ClaudeError` class, update the `kind` type to include `'quota'`:

```typescript
export class ClaudeError extends Error {
  constructor(message: string, public kind: 'auth' | 'rate' | 'quota' | 'network' | 'parse' | 'unknown') {
    super(message);
  }
}
```

### 10b — Update `generateRecipes` to route by mode

Replace the entire `generateRecipes` function with:

```typescript
export async function generateRecipes(input: GenerateInput): Promise<Recipe[]> {
  // Proxy mode (default for shared users — no API key required)
  if (!input.settings.byok) {
    const { backendGenerateRecipes } = await import('./backend');
    return backendGenerateRecipes(input);
  }

  // BYOK mode — original direct-to-Anthropic path
  const { settings, profile, mealType } = input;
  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError(
      'No API key set. Go to Settings → Developer and paste your Anthropic API key.',
      'auth',
    );
  }

  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
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
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string } | null;
    if (err?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (err?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if ((err?.status ?? 0) >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(err?.message ?? 'Network error', 'network');
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');

  const parsed = parseJsonLoose(textBlock.text);
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
```

### 10c — Update `generateDishRecipe` to route by mode

Replace the entire `generateDishRecipe` function with:

```typescript
export async function generateDishRecipe(input: {
  dishName: string;
  pantry: Ingredient[];
  profile: Profile;
  settings: Settings;
}): Promise<Recipe> {
  if (!input.settings.byok) {
    const { backendGenerateDishRecipe } = await import('./backend');
    return backendGenerateDishRecipe(input);
  }

  // BYOK path — original code below (unchanged)
  const { dishName, pantry, profile, settings } = input;
  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError('No API key set. Go to Settings → Developer and paste your Anthropic API key.', 'auth');
  }

  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
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
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string } | null;
    if (err?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (err?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if ((err?.status ?? 0) >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(err?.message ?? 'Network error', 'network');
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');

  const parsed = parseJsonLoose(textBlock.text);
  if (!isValidAIDishResponse(parsed)) throw new ClaudeError('Claude returned malformed recipe data.', 'parse');

  const raw = parsed as { recipe: {
    name: string; cookTime: number; difficulty: Level; calories: number;
    ingredients: { name: string; amount: string; missing: boolean; pantryCategory?: unknown }[];
    steps: string[]; chefTips?: string[]; serving?: string;
  } };

  const ai = raw.recipe;
  const now = new Date().toISOString();
  const id = `${Date.now()}-dish`;

  return {
    id, name: ai.name, cookTime: ai.cookTime, difficulty: ai.difficulty,
    calories: ai.calories, servings: profile.servings,
    ingredients: ai.ingredients.map(ing => {
      const has = pantryMatchesName(pantry, ing.name);
      const cat = coerceOptionalPantryCat(ing.pantryCategory);
      return { name: ing.name, amount: ing.amount, missing: !has,
        pantryCategory: !has ? (cat ?? 'other') : undefined };
    }),
    steps: ai.steps,
    chefTips: Array.isArray(ai.chefTips)
      ? ai.chefTips.filter(x => typeof x === 'string' && x.trim()) : [],
    serving: typeof ai.serving === 'string' && ai.serving.trim()
      ? ai.serving.trim() : `Serves ${profile.servings}`,
    mealType: 'comfort', createdAt: now, starred: false,
  };
}
```

### 10d — Update `suggestSubstitutions` to route by mode

Replace the entire `suggestSubstitutions` function with:

```typescript
export async function suggestSubstitutions(input: {
  missingIngredientNames: string[];
  pantry: Ingredient[];
  settings: Settings;
}): Promise<string> {
  if (!input.settings.byok) {
    const { backendSuggestSubstitutions } = await import('./backend');
    return backendSuggestSubstitutions(input);
  }

  // BYOK path — original code
  const { missingIngredientNames, pantry, settings } = input;
  if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
    throw new ClaudeError('No API key set. Go to Settings → Developer and paste your Anthropic API key.', 'auth');
  }
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const user = buildSubstitutionPrompt(missingIngredientNames, pantry);
  let response;
  try {
    response = await client.messages.create({
      model: MODEL_ID[settings.model], max_tokens: 1024,
      messages: [{ role: 'user', content: user }],
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string } | null;
    if (err?.status === 401) throw new ClaudeError('Invalid API key.', 'auth');
    if (err?.status === 429) throw new ClaudeError('Rate limit hit. Try again in a moment.', 'rate');
    if ((err?.status ?? 0) >= 500) throw new ClaudeError('Anthropic service error. Try again.', 'network');
    throw new ClaudeError(err?.message ?? 'Network error', 'network');
  }
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new ClaudeError('No text in Claude response.', 'parse');
  return textBlock.text.trim();
}
```

### 10e — Update `scanProductPhoto` to route by mode

Replace the entire `scanProductPhoto` function with:

```typescript
export async function scanProductPhoto(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient> {
  if (!settings.byok) {
    const { backendScanProductPhoto } = await import('./backend');
    return backendScanProductPhoto(imageBase64, mediaType, language);
  }
  // BYOK path — original code
  const client = makeClient(settings);
  const text = await visionCall(client, buildProductPhotoPrompt(language), imageBase64, mediaType);
  const parsed = parseJsonLoose(text) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new ClaudeError('Could not identify ingredient from photo.', 'parse');
  const maybe = parsed as { name?: unknown; amount?: unknown; category?: unknown };
  if (typeof maybe.name !== 'string' || !maybe.name.trim()) throw new ClaudeError('Could not identify ingredient from photo.', 'parse');
  return {
    name: maybe.name.trim(),
    amount: typeof maybe.amount === 'string' ? maybe.amount.trim() || undefined : undefined,
    category: coerceCategory(maybe.category),
  };
}
```

### 10f — Update `scanReceipt` to route by mode

Replace the entire `scanReceipt` function with:

```typescript
export async function scanReceipt(
  imageBase64: string,
  mediaType: string,
  language: Language,
  settings: Settings,
): Promise<ScannedIngredient[]> {
  if (!settings.byok) {
    const { backendScanReceipt } = await import('./backend');
    return backendScanReceipt(imageBase64, mediaType, language);
  }
  // BYOK path — original code
  const client = makeClient(settings);
  const text = await visionCall(client, buildReceiptPrompt(language), imageBase64, mediaType);
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
```

---

## Step 11 — Update `src/lib/i18n.ts`

Add these keys to **all three** locale objects (EN, EL, ES). Insert them
after the existing `apiKey` / `apiKeyHint` group, keeping alphabetical-ish
order within each block.

**English (EN):**
```typescript
quotaReached: "You've used all 3 free recipes for today. Come back tomorrow! 🍽️",
quotaRemainingOne: '1 recipe left today',
quotaRemainingN: '{n} recipes left today',
byok: 'Direct API (Developer)',
byokHint: 'Use your own Anthropic key instead of the shared proxy.',
byokEnabled: 'Direct mode — using your API key.',
```

**Greek (EL):**
```typescript
quotaReached: 'Χρησιμοποίησες και τις 3 συνταγές σου για σήμερα. Επέστρεψε αύριο! 🍽️',
quotaRemainingOne: '1 συνταγή απομένει σήμερα',
quotaRemainingN: '{n} συνταγές απομένουν σήμερα',
byok: 'Απευθείας API (Προχωρημένο)',
byokHint: 'Χρήση δικού σου Anthropic κλειδιού.',
byokEnabled: 'Απευθείας λειτουργία — χρησιμοποιείς το δικό σου κλειδί.',
```

**Spanish (ES):**
```typescript
quotaReached: 'Has usado tus 3 recetas gratis de hoy. ¡Vuelve mañana! 🍽️',
quotaRemainingOne: '1 receta restante hoy',
quotaRemainingN: '{n} recetas restantes hoy',
byok: 'API directa (Desarrollador)',
byokHint: 'Usa tu propia clave de Anthropic en lugar del proxy compartido.',
byokEnabled: 'Modo directo — usando tu clave de API.',
```

---

## Step 12 — Update `src/pages/SettingsPage.tsx`

### 12a — Hide the API key field behind the BYOK toggle

The API key section should only show when `settings.byok` is `true`.
Add a new `byok` state variable and wire it to `saveSettings`. Wrap the
existing API key `<Field>` block so it renders conditionally.

Near the top of `SettingsPage()`, add a new state variable after the
existing ones:

```typescript
const [byok, setByok] = useState<boolean>(settings.byok ?? false);
```

Add a new handler:

```typescript
async function handleByokToggle(enabled: boolean) {
  setByok(enabled);
  await saveSettings({ ...settings, byok: enabled, model, recipeSpeed });
}
```

### 12b — Add a "Developer" section at the bottom of Settings

Add this block **just above** the existing Danger zone `<div style={{ marginTop: 40 }}>` block:

```tsx
{/* Developer / BYOK — low-prominence advanced section */}
<div style={{ marginTop: 40 }}>
  <div
    style={{
      fontSize: T.fontSize.small,
      fontWeight: 600,
      letterSpacing: 0.4,
      color: 'var(--mise-text-tertiary)',
      marginBottom: 12,
      fontFamily: 'var(--mise-font-text)',
      textTransform: 'uppercase',
    }}
  >
    Developer
  </div>

  {/* BYOK toggle */}
  <Field label={t('byok')} hint={t('byokHint')}>
    <Segmented<'proxy' | 'byok'>
      value={byok ? 'byok' : 'proxy'}
      onChange={v => handleByokToggle(v === 'byok')}
      options={[
        { value: 'proxy', label: 'Shared proxy' },
        { value: 'byok', label: 'My key' },
      ]}
    />
  </Field>

  {/* API key input — only visible when BYOK is on */}
  {byok && (
    <Field label={t('apiKey')} hint={t('apiKeyHint')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          value={keyDraft}
          onChange={v => { setKeyDraft(v); setKeyState('unchecked'); }}
          placeholder={t('apiKeyPlaceholder')}
          type="password"
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PrimaryButton
            onClick={handleSaveKey}
            disabled={!keyDraft || keyState === 'checking'}
          >
            {keyState === 'checking' ? t('validating') : t('testKey')}
          </PrimaryButton>
          <KeyStatusBadge state={keyState} t={t} />
        </div>
        {validationError && (
          <div
            style={{
              fontSize: T.fontSize.small,
              color: 'var(--mise-error)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            <AlertCircle size={13} color="var(--mise-error)" />
            {validationError}
          </div>
        )}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--mise-primary)',
            fontSize: T.fontSize.small,
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          → {t('getApiKey')}
        </a>
      </div>
    </Field>
  )}
</div>
```

After doing this, **remove** the existing API key `<Field>` block from its
current position (the one that renders unconditionally near the top of the
form). It has been moved into the Developer section above.

---

## Step 13 — Update `tsconfig.json`

The `api/` folder needs to be included in TypeScript compilation. Open
`tsconfig.json` and find the `include` array. Add `"api"` to it:

```json
"include": ["src", "api"]
```

If there's no `include` array, the default already includes everything,
so no change is needed.

However, the `api/` files are Node.js (not browser) code, so they need
different compiler settings. Create a separate `tsconfig.api.json` in the
project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": ".vercel/output/functions"
  },
  "include": ["api/**/*.ts"]
}
```

The main `tsconfig.json` should **not** include `"api"` in its `include`
array — the API functions use CommonJS (`require`) via dynamic `import()`
which is different from the browser ESM build. Keep `tsconfig.json` as-is
for the `src/` files.

---

## Step 14 — Add `vercel.json` build configuration

Replace the entire contents of `vercel.json` with:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This tells Vercel to build the Vite app and serve the `dist/` folder as the
static site. The `api/` serverless functions are detected automatically.

---

## Step 15 — Final check

Run:

```bash
npm run quality
```

All three checks (typecheck, lint, tests) must pass with zero warnings.
Fix any errors before stopping.

If typecheck fails on `api/ai.ts` with "cannot find module '@vercel/node'",
confirm Step 5 ran correctly (`npm install --save-dev @vercel/node`).

If typecheck fails on dynamic imports in `api/ai.ts` (e.g. "prompts.js not
found"), change the dynamic import paths to use `.ts` extension and add
`"moduleResolution": "bundler"` to `tsconfig.api.json`.

---

## What was intentionally NOT changed in Round A

- `src/lib/nutrition.ts` and its `callClaude` usage — those calls use a
  separate `apiKey` parameter and are a secondary feature. They will only
  work in BYOK mode until Round C.
- Onboarding — the API key step is still present but will be removed in
  Round B.
- Error display in pages — the existing `ClaudeError` handling in pages
  already shows `err.message`, so the new quota message will display
  correctly without page changes.

---

## Deployment checklist (do this after `npm run quality` passes)

1. Push to your GitHub repo.
2. In the Vercel dashboard → your project → Settings → Environment Variables,
   add:
   - `ANTHROPIC_API_KEY` = your key (Production only — do NOT add to Preview)
   - `UPSTASH_REDIS_REST_URL` = from Upstash console
   - `UPSTASH_REDIS_REST_TOKEN` = from Upstash console
3. Redeploy. Test with a fresh browser profile (no IndexedDB) to confirm a
   new device ID is generated and proxy calls succeed.
4. Generate 3 recipes to confirm the quota kicks in on the 4th attempt.
