# Cursor agent guide — Mise

This file tells Cursor (or any AI coding assistant) the conventions of
this codebase so suggestions don't drift from the design intent.

**App:** Mise — AI sous chef PWA (`kitchen-assistant/` folder, package name `mise`).

## TL;DR for the agent

- **Stack:** Vite + React 18 + TypeScript + Tailwind CSS v4 + Radix UI
  (shadcn-style primitives in `src/components/ui/`).
- **Styling:** "Liquid Glass" design system. CSS variables in
  `src/styles/theme.css` (`--mise-*`) are the source of truth. Pages use
  **inline styles** referencing those vars. `src/tokens.ts` is a legacy
  compat shim (`T.bg` → `var(--mise-background)`); prefer `var(--mise-*)`
  in new code.
- **State:** One global context (`useApp()`), no Redux/Zustand/Jotai.
- **Storage:** IndexedDB via `idb-keyval`, wrapped in `src/lib/db.ts`.
  Never call `set()` / `get()` directly from components — always through
  the context mutators (addIngredient, saveProfile, etc).
- **AI:** Anthropic SDK in browser with `dangerouslyAllowBrowser: true`.
  Code lives in `src/lib/claude.ts`. Prompts live in `src/lib/prompts.ts`.
  Don't scatter prompt strings into other files.
- **i18n:** Every user-visible string goes through `t('keyName')`. New
  strings must be added to ALL of `EN`, `EL`, and `ES` in
  `src/lib/i18n.ts` — the TypeScript types enforce this.
- **Icons:** `lucide-react` in new code; legacy inline SVGs in
  `src/components/Icons.tsx`.
- **Code quality:** `npm run quality` runs typecheck + ESLint + tests in
  one shot. Run it before pushing.

## Style conventions

### Colors & tokens

Source of truth: `src/styles/theme.css`.

```tsx
// Preferred in new code
style={{ color: 'var(--mise-text-primary)', background: 'var(--mise-glass-fill)' }}

// Legacy shim — still works in existing pages
import { T } from '@/tokens';
style={{ color: T.text, background: T.surface }}
```

Never hard-code hex values in components. If a needed shade doesn't
exist, add it to `theme.css` first (and optionally mirror in `tokens.ts`).

### Tailwind & CSS files

Styles are imported once in `src/main.tsx` via `src/styles/index.css`, which
pulls in `tailwind.css`, `theme.css`, and `animations.css`.

- **Tailwind** is used for `src/components/ui/*` (shadcn/Radix primitives).
  Do not sprinkle Tailwind utility classes onto page-level components —
  those stay inline-style + CSS vars.
- **Motion utility classes** live in `src/styles/animations.css`.
  Components opt in via `className` (e.g. `press`, `fade-up`, `page-enter`).
- **No styled-components, Emotion, or second CSS framework.**

### Component patterns

```tsx
// Most screens follow this skeleton
function MyPage() {
  const { someData, t } = useApp();
  return (
    <Screen>
      <div style={{ padding: '8px 20px 28px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--mise-text-primary)' }}>
          {t('myPage')}
        </h1>
        {/* content */}
      </div>
    </Screen>
  );
}
```

- Use `<Screen>` for top-level wrapper (safe-area, background, tab-bar padding).
- Use `<SubHeader>` for inner/flow pages (generate, settings, detail).
  Home uses `<AppHeader>`. History/Pantry use inline page titles.
- Don't create new `<header>` / `<nav>` components — extend `Chrome.tsx`.
- For modals, drawers, dropdowns: use `src/components/ui/*` (Dialog,
  Sheet, DropdownMenu, etc.) — already themed to Mise glass.

### Forms

Two layers coexist:

1. **`src/components/Forms.tsx`** — `Field`, `Input`, `Segmented`, `Stepper`,
   `PrimaryButton`, `GhostButton`. Used on Profile, Settings, Onboarding.
2. **`src/components/ui/*`** — shadcn inputs/buttons for newer glass UI
   (Pantry dialogs, etc.).

Don't write raw styled `<input>`/`<button>` unless adding a primitive to
one of those files.

### Animations

Animations are encouraged. The "no CSS-in-JS library" rule does NOT mean
"no animations" or "no `<style>` tags".

1. Keyframes and utility classes live in **`src/styles/animations.css`**.
2. Components add behavior via `className`, not new styles:
   ```tsx
   <button className="press" style={{ ...allTheRealStyling }}>…</button>
   ```
3. `prefers-reduced-motion` is handled globally in `animations.css` — don't
   repeat per-rule.
4. Animate only `transform`, `opacity`, `filter`. Keep durations ≤200ms
   for feedback, ≤350ms for entrances.
5. **Don't add framer-motion / react-spring** without explicit approval.

### Adding a new page

1. Create `src/pages/MyPage.tsx`.
2. Add the route to `src/App.tsx` (look for the `<Routes>` block).
3. If it needs new i18n strings, add them to **all three** of EN, EL
   and ES in `src/lib/i18n.ts` — the type system will complain until
   they match.

## Project layout (key files)

```
src/
├── App.tsx                  router + provider + update banner + onboarding gate
├── main.tsx                 entry + PWA service worker registration
├── tokens.ts                legacy T.* shim → --mise-* CSS vars
├── styles/
│   ├── index.css            imports tailwind + theme + animations
│   ├── theme.css            --mise-* design tokens (source of truth)
│   ├── tailwind.css         Tailwind v4 + tw-animate-css
│   └── animations.css       press, fade-up, page-enter, reduced-motion
├── lib/
│   ├── app-state.tsx        React Context — useApp()
│   ├── db.ts                IndexedDB (idb-keyval)
│   ├── claude.ts            Anthropic SDK wrapper
│   ├── prompts.ts           all AI prompts
│   ├── i18n.ts              EN + EL + ES
│   ├── types.ts             interfaces + CATEGORIES
│   ├── date.ts              daysUntil, date helpers
│   ├── generate-flow.ts     sessionStorage shim for /generate reload
│   ├── onboarding-state.ts  first-run flag
│   ├── pantry-match.ts      fuzzy owned-vs-missing match
│   ├── feed.ts              home-screen meal/fact cards
│   ├── theme.ts             light/dark theme application
│   └── pwa.ts               update notification bridge
├── components/
│   ├── Chrome.tsx           Screen, AppHeader, SubHeader, TabBar
│   ├── Forms.tsx            legacy form primitives
│   ├── ui/                  shadcn/Radix primitives (Dialog, Sheet, …)
│   ├── RecipeCard.tsx, FeedCard.tsx, CameraImport.tsx, …
│   └── PantryIngredientDrawer.tsx
└── pages/
    OnboardingPage, HomePage, PantryPage, IngredientFormPage,
    ProfilePage, SettingsPage, MealTypePage, LoadingPage,
    ResultsPage, RecipeDetailPage, DishPage, HistoryAndFavorites
```

Path alias `@/` → `src/` (see `vite.config.ts`).

## Data flow

```
IndexedDB  ←──  db.ts  ←──  app-state.tsx (context)  ←──  pages/components (useApp)
                                  ↓
                            Anthropic API
                              (claude.ts)
```

- Components NEVER import `db.ts` directly. Always go through `useApp()`.
- The provider loads everything once at mount and sets `ready = true`.
- Until `ready` (and onboarding check passes), the app shows `BrandedLoader`.
- Mutators in `useApp` set local state AND persist atomically.

## What NOT to do

- **Don't add styled-components / Emotion / a second CSS framework.**
  Tailwind v4 is already in the stack for `ui/` primitives only.
- **Don't sprinkle Tailwind classes on page components.** Pages = inline
  styles + `var(--mise-*)`. Tailwind stays in `components/ui/`.
- **Don't add a state management library.** The context is enough.
- **Don't proxy the Anthropic API through a server.** BYOK, browser-direct.
  Raise backend needs as an architectural change first.
- **Don't hardcode language strings.** Every user-facing string goes
  through `t()`. Add keys to all three locales in `i18n.ts` first.
- **Don't bypass `useApp` for storage reads.** That breaks reactivity.

## Testing the AI flow

If you want to iterate on prompts without burning tokens:

1. Open browser devtools → Application → IndexedDB → `keyval-store`.
2. Run a generation, inspect the network tab to see what was sent.
3. Edit `src/lib/prompts.ts`, save — dev server hot-reloads.
4. Repeat.

The cheapest model is `claude-haiku-4-5` — switch to it in Settings
while iterating, switch back to Sonnet when done. Vision calls always
use Haiku regardless of the model setting.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (port 5173, `--host` for phone testing) |
| `npm run build` | Production build |
| `npm run quality` | typecheck + lint + test |
| `npm run generate-assets` | Rasterize icon.svg → PNGs + iOS splashes |
