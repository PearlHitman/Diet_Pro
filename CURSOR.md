# Cursor agent guide

This file tells Cursor (or any AI coding assistant) the conventions of
this codebase so suggestions don't drift from the design intent.

## TL;DR for the agent

- **Stack:** Vite + React 18 + TypeScript, no Tailwind, no CSS-in-JS lib.
  Styles are inline objects using the `T` design token from `src/tokens.ts`.
- **State:** One global context (`useApp()`), no Redux/Zustand/Jotai.
- **Storage:** IndexedDB via `idb-keyval`, wrapped in `src/lib/db.ts`.
  Never call `set()` / `get()` directly from components — always through
  the context mutators (addIngredient, saveProfile, etc).
- **AI:** Anthropic SDK in browser with `dangerouslyAllowBrowser: true`.
  Code lives in `src/lib/claude.ts`. Prompt lives in `src/lib/prompts.ts`.
  Don't scatter prompt strings into other files.
- **i18n:** Every user-visible string goes through `t('keyName')`. New
  strings must be added to BOTH `EN` and `EL` in `src/lib/i18n.ts` —
  the TypeScript types enforce this.

## Style conventions

### Colors

```ts
import { T } from '@/tokens'; // or relative path
// T.bg, T.surface, T.text, T.text2, T.muted, T.accent, T.warning, T.danger, ...
```

Never hard-code hex values in components. If a needed shade doesn't
exist in `T`, add it to `tokens.ts` first.

### Component patterns

```tsx
// All screens follow this skeleton
function MyPage() {
  const { someData, t } = useApp();
  return (
    <Screen>
      <SubHeader title={t('myPage')} />
      <div style={{ padding: '16px 20px 28px' }}>
        {/* content */}
      </div>
    </Screen>
  );
}
```

- Use `<Screen>` for top-level wrapper (handles safe-area, background).
- Use `<SubHeader>` for everything except Home (which uses `<AppHeader>`).
- Don't create new `<header>` / `<nav>` components — extend `Chrome.tsx`.

### Forms

Use `Field`, `Input`, `Segmented`, `Stepper`, `PrimaryButton`, `GhostButton`
from `src/components/Forms.tsx`. Don't write raw `<input>`/`<button>` with
custom styling unless you're adding a primitive to that file.

### Adding a new page

1. Create `src/pages/MyPage.tsx`.
2. Add the route to `src/App.tsx` (look for the `<Routes>` block).
3. If it needs new i18n strings, add them to **both** EN and EL in
   `src/lib/i18n.ts` and the type system will complain until they match.

## Data flow

```
IndexedDB  ←──  db.ts  ←──  app-state.tsx (context)  ←──  pages/components (useApp)
                                  ↓
                            Anthropic API
                              (claude.ts)
```

- Components NEVER import `db.ts` directly. Always go through `useApp()`.
- The provider loads everything once at mount and sets `ready = true`.
- Until `ready`, the router shows a tiny "…" loading state.
- Mutators in `useApp` set local state AND persist atomically.

## Known tasks to do next (priority order)

1. **Bottom tab bar.** Currently nav is via home tiles. A tab bar
   (Home, Pantry, History, Favorites, Profile) on screens that aren't
   modals/flows would feel more native. Skip on `/generate*`, `/results`,
   `/recipe/*`. Should respect safe-area-inset-bottom.

2. **History date grouping.** The list is flat — group by day with
   sticky date headers ("Today", "Yesterday", "Mon Nov 3"). The original
   design canvas in `homes.jsx` / `screens-recipe.jsx` shows the
   intended look.

3. **Pantry search/filter.** Above the category groups, add a search
   input that filters by name. Add a "show expiring only" toggle.

4. **Regenerate one.** On Results page, each recipe gets a small
   "regenerate this one" button that re-runs Claude with the prompt
   adjusted to "replace recipe #N keeping the others". Trickier than it
   sounds — talk through the prompt change first.

5. **PNG icons.** Run `npm install -D sharp` then write a small node
   script that rasterizes `public/icons/icon.svg` to 192/512 PNGs into
   the same folder. Run once, commit the PNGs.

6. **Pantry import.** Settings → "Import pantry from text" — paste a
   shopping list, Claude parses it into structured ingredients with
   guessed categories. Uses Haiku for cheapness. Endpoint signature:
   `parseShoppingList(text: string, settings: Settings): Promise<Ingredient[]>`
   in `claude.ts`.

## What NOT to do

- **Don't add a CSS framework.** Tailwind/styled-components/etc. The
  inline-style + tokens pattern is intentional and matches the original
  design files. Mixing styles will produce ugly inconsistencies.
- **Don't add a state management library.** The context is enough for
  4 data shapes. If it ever isn't, prefer adding a second context over
  pulling in Redux.
- **Don't proxy the Anthropic API through a server.** The whole point
  of this app is BYOK, browser-direct. If you find yourself wanting a
  backend, raise it as an architectural change first — don't just add it.
- **Don't hardcode language strings.** Every user-facing string goes
  through `t()`. If a key is missing, add it to i18n.ts FIRST.
- **Don't bypass `useApp` for storage reads.** That breaks reactivity —
  components won't re-render when data changes.

## Testing the AI flow

If you want to iterate on prompts without burning tokens:

1. Open browser devtools → Application → IndexedDB → `keyval-store`.
2. Run a generation, inspect the network tab to see what was sent.
3. Edit `src/lib/prompts.ts`, save, the dev server hot-reloads.
4. Repeat.

The cheapest model is `claude-haiku-4-5` — switch to it in Settings
while iterating, switch back to Sonnet when done.
