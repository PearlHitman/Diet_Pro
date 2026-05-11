// First-run flag. Lives in IndexedDB so it survives reloads but resets
// when the user taps "Reset all data" in Settings.

import { get, set, del } from 'idb-keyval';

const KEY = 'kitchen:onboarded:v1';

export async function isOnboarded(): Promise<boolean> {
  return (await get<boolean>(KEY)) === true;
}

export async function markOnboarded(): Promise<void> {
  await set(KEY, true);
}

export async function resetOnboarded(): Promise<void> {
  await del(KEY);
}
