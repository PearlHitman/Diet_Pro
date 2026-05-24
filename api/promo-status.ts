// Vercel Serverless Function — /api/promo-status
//
// Returns the current promo state for a device so the frontend can
// display live info (days remaining, daily limit, grace period, etc.)
//
// Request:  GET /api/promo-status  +  X-Device-ID header
// Response: PromoStatus JSON

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { promoKey } from './redeem';

// ─── Constants ────────────────────────────────────────────────

const GRACE_DAYS   = 5;
const PROMO_DAYS   = 90;
const PROMO_LIMIT  = 20;
const DEFAULT_LIMIT = 3;

// ─── Helpers ──────────────────────────────────────────────────

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
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

// ─── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID');

  const deviceId = (req.headers['x-device-id'] as string | undefined)?.trim() || 'unknown';

  const db = getRedis();
  if (!db) {
    // Storage unavailable — return safe default
    return res.status(200).json({
      active: false,
      dailyLimit: DEFAULT_LIMIT,
      inGracePeriod: false,
    });
  }

  const record = await db.get<{ code: string; activatedAt: string }>(promoKey(deviceId)).catch(() => null);

  if (!record) {
    return res.status(200).json({
      active: false,
      dailyLimit: DEFAULT_LIMIT,
      inGracePeriod: false,
    });
  }

  const now          = new Date().toISOString();
  const daysSince    = daysBetween(record.activatedAt, now);
  const gracePeriodEnds = addDays(record.activatedAt, GRACE_DAYS);
  const expiresAt    = addDays(record.activatedAt, PROMO_DAYS);
  const expired      = daysSince >= PROMO_DAYS;
  const inGracePeriod = daysSince < GRACE_DAYS;
  const daysRemaining = Math.max(0, PROMO_DAYS - daysSince);

  if (expired) {
    return res.status(200).json({
      active: false,
      code: record.code,
      activatedAt: record.activatedAt,
      gracePeriodEnds,
      expiresAt,
      dailyLimit: DEFAULT_LIMIT,
      inGracePeriod: false,
      daysRemaining: 0,
      expired: true,
    });
  }

  return res.status(200).json({
    active: true,
    code: record.code,
    activatedAt: record.activatedAt,
    gracePeriodEnds,
    expiresAt,
    dailyLimit: inGracePeriod ? 0 : PROMO_LIMIT, // 0 = no limit during grace
    inGracePeriod,
    daysRemaining,
  });
}
