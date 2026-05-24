// Vercel Serverless Function — /api/ai
//
// Single endpoint for all AI actions. The browser sends a pre-built prompt
// (assembled in src/lib/claude.ts using the app's prompts.ts), so this file
// has zero knowledge of the app's data model — it's a thin authenticated proxy.
//
// Request:  POST /api/ai  (JSON body + X-Device-ID header)
// Response: { text: string }  |  { error: string } + appropriate HTTP status
//
// Rate limit:
//   Default:                3 requests/device/day
//   Promo (grace, days 0-4): no limit
//   Promo (days 5-90):      20 requests/device/day
//   Promo expired (>90d):   back to 3/day
//
// Fail-open: if Upstash is unreachable, the request goes through anyway.
// The Anthropic spend cap ($10/month, set in console.anthropic.com) is the
// real safety net.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { promoKey } from './redeem';

// ─── Types ────────────────────────────────────────────────────

type Action = 'recipes' | 'dish' | 'substitutions' | 'product-photo' | 'receipt';

interface TextBody {
  action: 'recipes' | 'dish' | 'substitutions';
  model: string;
  maxTokens: number;
  system?: string;
  prompt: string;
}

interface VisionBody {
  action: 'product-photo' | 'receipt';
  prompt: string;
  imageBase64: string;
  mediaType: string;
  maxTokens?: number;
}

type RequestBody = TextBody | VisionBody;

// ─── Allowed actions ──────────────────────────────────────────

const ALLOWED_ACTIONS: ReadonlySet<Action> = new Set([
  'recipes', 'dish', 'substitutions', 'product-photo', 'receipt',
]);

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_LIMIT = 3;
const PROMO_LIMIT   = 20;
const GRACE_DAYS    = 5;
const PROMO_DAYS    = 90;

// ─── Redis client (lazily constructed) ───────────────────────

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    return null;
  }
}

// ─── Rate limiters (one per limit value, lazily constructed) ──

const rlCache: Map<number, Ratelimit> = new Map();

function getRateLimiter(limit: number): Ratelimit | null {
  if (rlCache.has(limit)) return rlCache.get(limit)!;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // env not configured — fail open
  try {
    const instance = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(limit, '1 d'),
      prefix: `mise:rl:${limit}`,
    });
    rlCache.set(limit, instance);
    return instance;
  } catch {
    return null;
  }
}

// ─── Promo check ──────────────────────────────────────────────
// Returns the effective daily request limit for a given device.
// 0 means "no limit" (grace period).

async function getEffectiveLimit(deviceId: string): Promise<number> {
  const db = getRedis();
  if (!db) return DEFAULT_LIMIT;

  try {
    const record = await db.get<{ code: string; activatedAt: string }>(promoKey(deviceId));
    if (!record) return DEFAULT_LIMIT;

    const daysSince = Math.floor(
      (Date.now() - new Date(record.activatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= PROMO_DAYS) return DEFAULT_LIMIT; // promo expired
    if (daysSince < GRACE_DAYS)  return 0;             // grace — no limit
    return PROMO_LIMIT;                                 // active promo window
  } catch {
    return DEFAULT_LIMIT; // fail open
  }
}

// ─── Anthropic client (lazily constructed) ────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

// ─── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST allowed.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers so the PWA can call this from any origin (Vercel already
  // handles same-origin requests; this covers custom domains or local dev).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID');

  // ── Device ID ──
  const deviceId = (req.headers['x-device-id'] as string | undefined)?.trim() || 'unknown';

  // ── Rate limit (fail open on Upstash error) ──
  const effectiveLimit = await getEffectiveLimit(deviceId);

  if (effectiveLimit > 0) {
    // Apply the appropriate rate limiter (default 3 or promo 20)
    const limiter = getRateLimiter(effectiveLimit);
    if (limiter) {
      try {
        const { success, remaining } = await limiter.limit(deviceId);
        if (!success) {
          res.setHeader('X-RateLimit-Remaining', '0');
          const isPromo = effectiveLimit === PROMO_LIMIT;
          return res.status(429).json({
            error: isPromo
              ? `Daily limit reached (${PROMO_LIMIT}/day on your promo plan). Try again tomorrow.`
              : `You've used today's ${DEFAULT_LIMIT} free generations. Try again tomorrow, or enable your own API key in Settings → Developer.`,
          });
        }
        res.setHeader('X-RateLimit-Remaining', String(remaining));
      } catch {
        // Upstash unreachable — let the request through (fail open).
      }
    }
  }
  // effectiveLimit === 0 → grace period, no limit applied

  // ── Parse body ──
  const body = req.body as RequestBody | undefined;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const action = body.action as string | undefined;
  if (!action || !ALLOWED_ACTIONS.has(action as Action)) {
    return res.status(400).json({ error: `Invalid action: ${action ?? '(none)'}` });
  }

  // ── Call Anthropic ──
  let text: string;
  try {
    const client = getAnthropicClient();

    if (action === 'product-photo' || action === 'receipt') {
      // Vision call.
      const vb = body as VisionBody;
      if (!vb.imageBase64 || !vb.mediaType || !vb.prompt) {
        return res.status(400).json({ error: 'Missing imageBase64 / mediaType / prompt' });
      }
      const response = await client.messages.create({
        model: 'claude-haiku-4-5', // vision always uses Haiku
        max_tokens: vb.maxTokens ?? 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: vb.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: vb.imageBase64,
              },
            },
            { type: 'text', text: vb.prompt },
          ],
        }],
      });
      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') {
        return res.status(502).json({ error: 'Empty vision response from Anthropic' });
      }
      text = block.text;
    } else {
      // Text call.
      const tb = body as TextBody;
      if (!tb.prompt || !tb.model || !tb.maxTokens) {
        return res.status(400).json({ error: 'Missing prompt / model / maxTokens' });
      }
      const response = await client.messages.create({
        model: tb.model,
        max_tokens: tb.maxTokens,
        ...(tb.system ? { system: tb.system } : {}),
        messages: [{ role: 'user', content: tb.prompt }],
      });
      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') {
        return res.status(502).json({ error: 'Empty text response from Anthropic' });
      }
      text = block.text;
    }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string } | null;
    if (err?.status === 401) {
      return res.status(401).json({ error: 'Anthropic authentication failed — check ANTHROPIC_API_KEY.' });
    }
    if (err?.status === 429) {
      return res.status(429).json({ error: 'Anthropic rate limit hit. Try again in a moment.' });
    }
    const msg = err?.message ?? 'Unknown Anthropic error';
    console.error('[api/ai] Anthropic error:', msg);
    return res.status(502).json({ error: msg });
  }

  return res.status(200).json({ text });
}
