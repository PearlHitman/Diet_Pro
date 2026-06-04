// Vercel Serverless Function — /api/redeem
//
// Validates a promo code and activates it for a device.
// Stores activation in Redis so /api/ai can pick it up during rate limiting.
//
// Request:  POST /api/redeem  { code: string }  +  X-Device-ID header
// Response: { success: true, activatedAt: string }
//         | { error: string }  + appropriate HTTP status

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// ─── Redis key helpers ────────────────────────────────────────

export function promoKey(deviceId: string): string {
  return `mise:promo:${deviceId}`;
}

// ─── Redis client (lazy) ──────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch {
    return null;
  }
}

// ─── Valid codes ──────────────────────────────────────────────
// Set PROMO_CODES env var as comma-separated list, e.g. "CHEF90,BETA2024"

function getValidCodes(): Set<string> {
  const raw = process.env.PROMO_CODES ?? '';
  return new Set(
    raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
  );
}

// ─── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID');

  const deviceId = (req.headers['x-device-id'] as string | undefined)?.trim() || 'unknown';
  const body     = req.body as { code?: unknown } | undefined;
  const rawCode  = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (!rawCode) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const validCodes = getValidCodes();
  if (!validCodes.has(rawCode)) {
    return res.status(400).json({ error: 'Invalid promo code' });
  }

  const db = getRedis();
  if (!db) {
    return res.status(503).json({ error: 'Storage unavailable — try again later' });
  }

  // Check if already activated for this device
  const existing = await db.get<{ code: string; activatedAt: string }>(promoKey(deviceId)).catch(() => null);
  if (existing) {
    // Re-return existing activation — idempotent
    return res.status(200).json({ success: true, activatedAt: existing.activatedAt, alreadyActive: true });
  }

  // Activate
  const activatedAt = new Date().toISOString();
  const record = { code: rawCode, activatedAt };

  // Store for 91 days (90-day promo + 1 day buffer), TTL in seconds
  const TTL_SECONDS = 91 * 24 * 60 * 60;
  await db.set(promoKey(deviceId), record, { ex: TTL_SECONDS });

  return res.status(200).json({ success: true, activatedAt });
}
