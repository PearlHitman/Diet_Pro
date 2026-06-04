// Anonymous device identity for rate-limiting the backend proxy.
//
// Generates a UUID v4 on first launch and persists it in IndexedDB under its
// own key (separate from the main keyval store). The ID is local-only: it is
// only ever sent to *our* /api/ai endpoint as X-Device-ID so the server can
// enforce the 3-generations-per-day cap. It is never sent to Anthropic and
// contains no personal information.

import { get, set } from 'idb-keyval';

const DEVICE_ID_KEY = 'mise:device-id:v1';

function generateUUID(): string {
  // crypto.randomUUID() is available in all browsers we target (Chrome 92+,
  // Safari 15.4+, Firefox 95+) and in the service-worker context.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old environments (should never hit in practice).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await get<string>(DEVICE_ID_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fresh = generateUUID();
  await set(DEVICE_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}
