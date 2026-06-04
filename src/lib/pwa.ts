// Lightweight pub/sub so main.tsx can notify App.tsx when a new
// service worker is waiting without prop-drilling or a new context.

type UpdateFn = () => void;

let _pendingUpdate: UpdateFn | null = null;
let _subscriber: ((fn: UpdateFn) => void) | null = null;

/** Called by the React tree to learn about pending updates. */
export function subscribeToUpdate(callback: (fn: UpdateFn) => void) {
  _subscriber = callback;
  // If the SW was already ready before the component mounted, fire immediately.
  if (_pendingUpdate) callback(_pendingUpdate);
}

/** Called by main.tsx when registerSW fires onNeedRefresh. */
export function notifyUpdateAvailable(fn: UpdateFn) {
  _pendingUpdate = fn;
  _subscriber?.(fn);
}
