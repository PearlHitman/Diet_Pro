# Cursor Task: Meal Prep Week Feature

## Overview

Add a "Prep" tab to the existing Nutrition page (`src/pages/NutritionPage.tsx`). This tab lets users generate a full 7-day meal plan powered by Claude AI, then view a grocery list of everything they need to buy. The plan is aware of what's already in the pantry and the user's calorie/macro goals.

---

## Files to touch

1. `src/lib/types.ts` — add new types
2. `src/lib/db.ts` — add persistence for the meal plan
3. `src/lib/app-state.tsx` — expose meal plan state + mutations
4. `src/lib/prompts.ts` — add the AI prompt builder
5. `src/pages/NutritionPage.tsx` — add the 4th tab and all its UI

Do **not** create new routes or new pages. Everything lives inside `NutritionPage.tsx` as a new tab component.

---

## Step 1 — `src/lib/types.ts`

Add these types at the bottom of the file. Follow the existing style (no classes, plain interfaces).

```ts
// ---- Meal Plan ----

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMeal {
  id: string;            // uid
  slot: MealSlot;
  name: string;
  calories: number;
  protein: number;       // grams per serving
  carbs: number;         // grams per serving
  fat: number;           // grams per serving
  servings: number;
  ingredients: { name: string; amount: string; category: Category }[];
  cooked: boolean;       // true once user marks it done
}

export interface MealPlanDay {
  date: string;          // YYYY-MM-DD
  meals: PlannedMeal[];
}

export interface WeekMealPlan {
  id: string;
  createdAt: string;     // ISO datetime
  startDate: string;     // YYYY-MM-DD (Monday of the week)
  days: MealPlanDay[];   // always 7 entries
}

export interface GroceryItem {
  name: string;
  totalAmount: string;   // consolidated e.g. "600g" or "× 4"
  category: Category;
  checked: boolean;
}
```

---

## Step 2 — `src/lib/db.ts`

Add a new key to the `K` object and three functions. Follow the exact same pattern as `loadNutritionLog` / `saveNutritionLog`.

Add to the `K` object:
```ts
mealPlan: 'kitchen:mealplan:v1',
```

Add three functions:
```ts
export async function loadMealPlan(): Promise<WeekMealPlan | null> {
  return (await get<WeekMealPlan>(K.mealPlan)) ?? null;
}

export async function saveMealPlan(plan: WeekMealPlan): Promise<void> {
  await set(K.mealPlan, plan);
}

export async function deleteMealPlan(): Promise<void> {
  await del(K.mealPlan);
}
```

Also add `WeekMealPlan` to the import from `./types` at the top of `db.ts`.

Also clear it inside the existing `resetAll` / `del` block:
```ts
del(K.mealPlan),
```

---

## Step 3 — `src/lib/app-state.tsx`

### Add to the `AppState` interface:
```ts
mealPlan: WeekMealPlan | null;
saveMealPlan: (plan: WeekMealPlan) => Promise<void>;
updateMealPlan: (plan: WeekMealPlan) => Promise<void>; // same as save, alias for clarity
clearMealPlan: () => Promise<void>;
```

### Add state + initial load:
```ts
const [mealPlan, setMealPlanState] = useState<WeekMealPlan | null>(null);
```

In the `useEffect` initial load block, add `db.loadMealPlan()` alongside the existing parallel loads and set it:
```ts
setMealPlanState(mp);
```

### Add mutation callbacks (follow the exact `useCallback` pattern already used):
```ts
const saveMealPlan = useCallback(async (plan: WeekMealPlan) => {
  setMealPlanState(plan);
  await db.saveMealPlan(plan);
}, []);

const updateMealPlan = saveMealPlan; // alias

const clearMealPlan = useCallback(async () => {
  setMealPlanState(null);
  await db.deleteMealPlan();
}, []);
```

### Expose in the context value object (add alongside existing fields).

Also import `WeekMealPlan` from `./types`.

---

## Step 4 — `src/lib/prompts.ts`

Add a new exported function `buildWeekMealPlanPrompt`. Import `BodyStats`, `NutritionGoals`, `WeekMealPlan` as needed.

```ts
export function buildWeekMealPlanPrompt({
  pantry,
  profile,
  goals,
  startDate,
  swapDay,         // optional: only regenerate one day (0-6 index)
  swapSlot,        // optional: only regenerate one meal slot on swapDay
  batchCookHint,   // true = encourage batch cooking suggestions
}: {
  pantry: Ingredient[];
  profile: Profile;
  goals: NutritionGoals | null;
  startDate: string;
  swapDay?: number;
  swapSlot?: MealSlot;
  batchCookHint: boolean;
}): string
```

The function should build a detailed prompt that:

1. **Lists pantry ingredients** using the existing `formatPantry` helper (already in `prompts.ts`) — pantry items expiring soonest should be used first. The prompt should explicitly tell Claude to prioritise expiring items.

2. **States the calorie and macro targets** per day (from `goals`) so Claude can make each day hit the right numbers across all meals.

3. **Includes user profile context**: cuisine preference, dietary goal, allergies, servings.

4. **Batch cooking instruction**: if `batchCookHint` is true, include a note like: *"Where sensible, suggest batch-cooked ingredients that span multiple days (e.g., cook a large pot of grains on day 1 and reuse across later days). Note this explicitly in the meal name or ingredients."*

5. **Swap mode**: if `swapDay` and `swapSlot` are provided, the prompt should only ask Claude to return one meal for that specific slot on that day, not a full 7-day plan.

6. **Output format** — the prompt must end with a strict JSON schema. For a full plan:

```json
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": [
        {
          "slot": "breakfast" | "lunch" | "dinner" | "snack",
          "name": "string",
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number,
          "servings": number,
          "ingredients": [
            { "name": "string", "amount": "string", "category": "produce"|"protein"|"dairy"|"grains"|"pantry"|"other" }
          ]
        }
      ]
    }
  ]
}
```

For a swap (single meal), the response schema is just the single meal object (no `days` wrapper).

Study how `buildRecipePrompt` is structured in `prompts.ts` to match the style and the `formatPantry` helper call.

---

## Step 5 — `src/pages/NutritionPage.tsx`

This is the main work. Everything below is additive — do not break the existing Today / Week / Month tabs.

### 5a. Add "Prep" to the tab type

```ts
type Tab = 'today' | 'week' | 'month' | 'prep';
```

Update the tab labels array from `['today', 'week', 'month']` to `['today', 'week', 'month', 'prep']`.

The tab label for "prep" should render as **"Prep ✦"** (using the sparkle character already used elsewhere in the app).

Because there are now 4 tabs, you may need to slightly reduce the font size or padding on the segmented control so they all fit on one line without wrapping. Inspect the existing style and adjust accordingly.

### 5b. Add the tab render

```tsx
{tab === 'prep' && (
  <PrepTab
    pantry={pantry}
    profile={profile}
    goals={goals}
    settings={settings}
    mealPlan={mealPlan}
    onSavePlan={saveMealPlan}
    onUpdatePlan={updateMealPlan}
    onClearPlan={clearMealPlan}
    onLogMeal={addLoggedMeal}
  />
)}
```

Pull the needed values from `useApp()`.

### 5c. The `PrepTab` component

Build this as a function component in the same file. Break it into logical sub-components as needed.

#### States to manage inside PrepTab:
- `view: 'plan' | 'grocery'` — toggle between week plan and grocery list
- `generating: boolean` — AI is running
- `swappingId: string | null` — id of the PlannedMeal being regenerated (for per-meal loading state)
- `error: string` — error message if generation fails
- `groceryItems: GroceryItem[]` — derived from the plan, can be toggled checked/unchecked locally

#### Empty state (no plan yet):
Show a centred card with a short description and a prominent **"✦ Generate My Week"** button. Style it consistently with the rest of NutritionPage (glass fill background, primary purple button). Mention that it uses their pantry and calorie goals.

If `goals` is null (body stats not set up), show a note that they should set up body stats in Profile first — same pattern as the existing empty state in `TodayTab`.

#### Generating state:
Replace the button with a loading indicator and text like "Claude is planning your week…". Use the existing loading pattern from the app (simple text + subtle animation, no spinner library).

#### Plan view (week grid — vertical layout):

Render 7 day cards stacked vertically. Each card:
- Header: weekday name (Mon, Tue…) + date + **daily calorie total badge** (sum of all meals in that day, vs. the goals.calories target — color it green if within ±15%, red if over).
- Four meal rows inside the card: Breakfast, Lunch, Dinner, Snack.
  - Each row shows: slot emoji (🌅 breakfast, ☀️ lunch, 🌙 dinner, 🍎 snack) + meal name + calorie count.
  - A **"↻ Swap"** button on each row that triggers a single-meal regeneration for that slot.
  - A **"✓ Cooked"** button (or checkmark toggle) that, when tapped, calls `addLoggedMeal` to log that meal to the nutrition tracker for that day. Once cooked, the row shows a subtle strikethrough or muted styling and the button changes to "✓ Done".
  - While that specific meal is being swapped (`swappingId === meal.id`), show a subtle loading state on that row only.

Action buttons at the bottom of the plan view:
- **"↻ Regenerate full week"** — re-runs the full plan generation.
- **"🛒 View Grocery List (N items)"** — switches view to `'grocery'`. N is the count of `groceryItems` where `checked === false`.

#### Grocery list view:

A back button / header "← Back to Plan".

Compute `groceryItems` from the meal plan when switching to this view:
1. Collect all ingredients from all `PlannedMeal` entries across all 7 days.
2. For each ingredient, check if it exists in the pantry using `pantryMatchesName` from `src/lib/pantry-match.ts`. If it's in the pantry, **exclude it** from the list.
3. For ingredients not in the pantry, **consolidate duplicates** by name (case-insensitive). If the same ingredient appears in multiple meals, combine them into one `GroceryItem` with a consolidated `totalAmount` (e.g. "chicken breast" appearing as "200g", "300g", "250g" → "750g" if parseable as grams, or "× 3" if not parseable).
4. Group items by `category` (produce → protein → dairy → grains → pantry → other) — same `CATEGORY_ORDER` as `PantryPage.tsx`.
5. Each item has a checkbox. Tapping it toggles `checked` locally (state only, not persisted).

At the bottom: two buttons side by side:
- **"Copy list"** — copies the grocery list as plain text to clipboard (`navigator.clipboard.writeText`). Format: group headers in ALL CAPS, one item per line with its amount.
- **"Share ↗"** — uses the Web Share API (`navigator.share`) if available, falls back to clipboard copy with a toast "Copied to clipboard" if not. Show the Share button only if `navigator.share` is defined, otherwise just show Copy.

#### Error handling:
If the Claude call fails, show an inline error message (same style as `AddFoodSheet`). Provide a retry button.

---

## Constraints & patterns to follow

- **Styles**: All styles inline, using CSS variables from the design system (`var(--mise-primary)`, `var(--mise-glass-fill)`, `var(--mise-glass-border)`, `var(--mise-text-primary)`, `var(--mise-text-secondary)`, `var(--mise-text-tertiary)`, `var(--mise-error)`, `var(--mise-success)`). Follow `T.fontSize.*` from `src/tokens.ts` for font sizes. No Tailwind, no external style files.
- **Claude calls**: Use `callClaude` and `parseJsonLoose` from `src/lib/claude.ts`, exactly as done in `NutritionPage`'s `AddFoodSheet` and in `generate-flow.ts`. Use `settings.model` for the model. Use `settings.apiKey`.
- **IDs**: Use the existing `uid()` helper already defined at the top of `NutritionPage.tsx`.
- **Toasts**: Use `toast` from `sonner` for success/error feedback (e.g., "Meal logged ✓" when marking cooked).
- **Reduced motion**: Check `prefersReducedMotion()` from `src/lib/motion.ts` and skip transitions when true — same pattern as the rest of the page.
- **Safe area**: Bottom padding should include `env(safe-area-inset-bottom)` to avoid the tab bar overlap, same as elsewhere.
- **Date helpers**: Use `toDateStr` from `src/lib/nutrition.ts` for today's date. For the 7-day plan, start from the current Monday (compute it from today).
- **No new dependencies**: Do not add any npm packages.

---

## Grocery amount consolidation logic

This is the trickiest part. Here is the algorithm to implement:

```
function consolidateAmount(amounts: string[]): string {
  // Try to parse each as a gram value (e.g. "200g", "1.5kg")
  // If all parseable, sum and return e.g. "750g"
  // Otherwise return "× N" where N is the count
}
```

Parse grams: strip whitespace, match `/^(\d+\.?\d*)\s*(g|kg)$/i`. Convert kg → g. If all amounts in the group parse, sum them and return `${total}g` (or `${total/1000}kg` if ≥ 1000g). Otherwise return `× ${count}`.

---

## Summary of new files / changes

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `PlannedMeal`, `MealPlanDay`, `WeekMealPlan`, `GroceryItem`, `MealSlot` |
| `src/lib/db.ts` | Add `mealPlan` key, `loadMealPlan`, `saveMealPlan`, `deleteMealPlan`, clear in resetAll |
| `src/lib/app-state.tsx` | Add `mealPlan` state, `saveMealPlan`, `updateMealPlan`, `clearMealPlan` |
| `src/lib/prompts.ts` | Add `buildWeekMealPlanPrompt` |
| `src/pages/NutritionPage.tsx` | Add `'prep'` tab, `PrepTab` component, grocery list logic |

No new routes. No new files. No new dependencies.
