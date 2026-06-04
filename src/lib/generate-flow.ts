// Persists generation-flow state in sessionStorage so a mid-flow reload
// (on /generate/loading or /results) doesn't lose what the user picked.
//
// Why sessionStorage and not the IndexedDB store: this is ephemeral UI
// state for one flow attempt — sessionStorage is automatically cleared
// when the tab closes, which is exactly the right lifetime. We also
// avoid bloating the React Context with transient values.
//
// `location.state` remains the fast path; sessionStorage is just the
// fallback after a reload.

import { EMPTY_CUSTOMIZATION, type Customization, type MealType } from './types';

const FLOW_KEY = 'mise:generateFlow:v1';
const RESULTS_KEY = 'mise:generateResults:v1';

export interface GenerateFlowState {
  mealType: MealType;
  customization: Customization;
  dishIdea?: string;
  maxTime?: number;
  dietary?: string[];
}

function safeSession(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    // Some browsers throw if storage is disabled (e.g. private mode quirks).
    return null;
  }
}

export function saveFlowState(state: GenerateFlowState): void {
  const s = safeSession();
  if (!s) return;
  try {
    s.setItem(FLOW_KEY, JSON.stringify(state));
  } catch { /* quota or serialization issue — fall back silently */ }
}

export function loadFlowState(): GenerateFlowState | null {
  const s = safeSession();
  if (!s) return null;
  try {
    const raw = s.getItem(FLOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GenerateFlowState>;
    if (!parsed || typeof parsed !== 'object') return null;
    const mealType = parsed.mealType;
    if (mealType !== 'quick' && mealType !== 'healthy' && mealType !== 'comfort' && mealType !== 'festive') {
      return null;
    }
    return {
      mealType,
      customization: parsed.customization ?? EMPTY_CUSTOMIZATION,
      dishIdea: typeof parsed.dishIdea === 'string' ? parsed.dishIdea : undefined,
      maxTime: typeof parsed.maxTime === 'number' ? parsed.maxTime : undefined,
      dietary: Array.isArray(parsed.dietary) ? parsed.dietary.filter((x): x is string => typeof x === 'string') : undefined,
    };
  } catch {
    return null;
  }
}

export function saveResultIds(ids: string[]): void {
  const s = safeSession();
  if (!s) return;
  try {
    s.setItem(RESULTS_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

export function loadResultIds(): string[] {
  const s = safeSession();
  if (!s) return [];
  try {
    const raw = s.getItem(RESULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Clear all generate-flow scratch state.
 * Call when the user explicitly exits the flow (back to home, starts a
 * fresh gen etc) so a future reload doesn't restore stale data.
 */
export function clearFlowState(): void {
  const s = safeSession();
  if (!s) return;
  try {
    s.removeItem(FLOW_KEY);
    s.removeItem(RESULTS_KEY);
  } catch { /* ignore */ }
}
