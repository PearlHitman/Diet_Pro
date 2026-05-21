// Browser-side client for the /api/ai proxy.
//
// All AI calls that go through the backend (byok === false) come here.
// This module is the *only* place that knows about the /api/ai endpoint,
// the X-Device-ID header, and HTTP error mapping.
//
// It does NOT know about the app's data model — it just sends pre-built
// prompt text and returns raw text back to claude.ts for parsing.

import { ClaudeError } from './errors';
import { getDeviceId } from './device-id';

// ─── Request shapes ───────────────────────────────────────────

export type BackendAction =
  | 'recipes'
  | 'dish'
  | 'substitutions'
  | 'product-photo'
  | 'receipt';

interface TextPayload {
  action: 'recipes' | 'dish' | 'substitutions';
  model: string;
  maxTokens: number;
  system?: string;
  prompt: string;
}

interface VisionPayload {
  action: 'product-photo' | 'receipt';
  prompt: string;
  imageBase64: string;
  mediaType: string;
  maxTokens?: number;
}

export type BackendPayload = TextPayload | VisionPayload;

// ─── Response shape ───────────────────────────────────────────

interface BackendOk {
  text: string;
}

interface BackendErr {
  error: string;
}

type BackendResponse = BackendOk | BackendErr;

// ─── Main call ────────────────────────────────────────────────

/**
 * Send a request to /api/ai and return the raw text from Anthropic.
 * Throws ClaudeError on rate limit, network failure, or server error.
 */
export async function callBackend(payload: BackendPayload): Promise<string> {
  const deviceId = await getDeviceId().catch(() => 'unknown');

  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ClaudeError('Network error — check your connection.', 'network');
  }

  if (res.status === 429) {
    throw new ClaudeError(
      "You've used today's 3 free generations. Try again tomorrow, or enable your own API key in Settings → Developer.",
      'rate',
    );
  }

  if (res.status === 401) {
    // Server-side auth failure (misconfigured ANTHROPIC_API_KEY on Vercel).
    throw new ClaudeError('Server configuration error. Please contact support.', 'auth');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const msg = body.length < 200 ? body : `Server error ${res.status}`;
    throw new ClaudeError(msg, 'network');
  }

  const data = (await res.json()) as BackendResponse;

  if (!('text' in data) || typeof data.text !== 'string') {
    const errMsg = 'error' in data ? data.error : 'Empty response from server';
    throw new ClaudeError(errMsg, 'parse');
  }

  return data.text;
}
