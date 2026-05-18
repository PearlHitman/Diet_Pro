// Prompt construction for recipe generation.
// Edit here when you want to tune the AI's behavior — don't scatter
// prompts across the codebase.

import type { Customization, Ingredient, Language, MealType, Profile } from './types';
import { daysUntil } from './date';

export const DISH_SYSTEM_PROMPT = `You return precise, authentic recipes as JSON only — no markdown fences unless asked elsewhere.`;

// ─── Meal type descriptions ──────────────────────────────────

const MEAL_DESC: Record<MealType, string> = {
  quick:    'Quick meal — under 30 minutes total, minimal active cooking, few steps.',
  healthy:  'Healthy & light — lean proteins, vegetables, balanced macros, lower calorie.',
  comfort:  'Comfort food — hearty, warming, satisfying. Higher calorie is fine.',
  festive:  'Festive — impressive presentation, suitable for sharing or special occasions.',
};

// ─── Helpers ─────────────────────────────────────────────────

function formatPantry(pantry: Ingredient[]): string {
  if (pantry.length === 0) return '(pantry is empty)';
  return pantry
    .map(it => {
      const days = daysUntil(it.expiresOn);
      let suffix = '';
      if (days !== null) {
        if (days < 0)        suffix = ` (EXPIRED ${-days}d ago)`;
        else if (days === 0) suffix = ' (expires TODAY — use it!)';
        else if (days <= 3)  suffix = ` (expires in ${days}d — prefer using)`;
      }
      const amount = it.amount ? ` [${it.amount}]` : '';
      return `- ${it.name}${amount}${suffix}`;
    })
    .join('\n');
}

// ─── Main prompt builder ─────────────────────────────────────

export interface PromptInput {
  pantry: Ingredient[];
  profile: Profile;
  mealType: MealType;
  customization?: Customization;
  /** When set — user asked for variants around a concrete dish idea. */
  dishIdea?: string;
  /** Fast mode: 2 compact recipes, shorter output. */
  speed?: boolean;
}

// System prompt sets the creative persona. Kept separate so claude.ts
// can pass it as the `system` parameter for stronger persona anchoring.
export const RECIPE_SYSTEM_PROMPT = `You are a creative chef with deep knowledge of world cuisines and a strong aversion to generic, forgettable food. You think like a restaurant professional: every dish has a specific identity, a dominant flavour strategy, and at least one technique worth learning.

You refuse to produce:
- Vague titles like "Chicken Stir-Fry", "Pasta with Sauce", "Vegetable Rice Bowl", "Egg Scramble"
- Steps written as bare instructions with no flavour or technique context ("cook the chicken")
- Three recipes that are structurally the same (e.g. three protein + grain + sauce combos)

You always produce:
- Specific, evocative names that hint at cuisine and technique ("Harissa-Braised Chickpeas with Whipped Feta" not "Chickpea Dish")
- Steps that explain the *why* alongside the *what* ("sear skin-side down without moving it so the fat renders and the skin crisps, ~6 min")
- Recipes the user will actually remember and want to repeat`;

export const RECIPE_SYSTEM_PROMPT_SPEED = `You are a practical home cook. Return only valid JSON — no markdown, no prose.
Use specific dish names (not "Chicken Stir-Fry"). Keep steps short and imperative.
Prioritize pantry items marked expiring soon. Be concise: fewer tokens = faster for the user.`;

export function buildRecipePrompt(input: PromptInput): string {
  if (input.speed) return buildRecipePromptSpeed(input);
  return buildRecipePromptBest(input);
}

function buildRecipePromptBest({
  pantry, profile, mealType, customization, dishIdea,
}: PromptInput): string {
  const trimmedDish = dishIdea?.trim();
  const dishSection = trimmedDish
    ? `\n═══ USER'S DISH IN MIND ═══
The user named a craving or dish they want to cook toward:
"${trimmedDish}"

Every recipe MUST clearly relate to this request — same culinary family,
spirit, technique, or dish type (adapt names and flavours to match). Do NOT
produce three unrelated generic meals. Stay honest about which ingredients are
really in their pantry versus missing.`
    : '';

  const langInstruction = profile.language === 'EL'
    ? 'CRITICAL OUTPUT LANGUAGE: All recipe content (names, ingredients, steps) MUST be in Greek (Ελληνικά). Numbers and units stay numeric.'
    : 'Output language: English.';

  // Build constraint sections only if non-empty
  const mustInclude = customization?.mustInclude ?? [];
  const skip = customization?.skip ?? [];

  const mustSection = mustInclude.length > 0
    ? `\n═══ USER REQUIREMENTS — MUST INCLUDE ═══
The user explicitly wants these ingredients featured in EVERY recipe:
${mustInclude.map(n => `- ${n}`).join('\n')}

This is non-negotiable. Each of the 3 recipes must use ALL of these
ingredients in a meaningful way (not just as a garnish).`
    : '';

  const skipSection = skip.length > 0
    ? `\n═══ USER REQUIREMENTS — DO NOT USE ═══
The user has explicitly asked to skip these for this generation:
${skip.map(n => `- ${n}`).join('\n')}

NEVER include these ingredients in any recipe, even in trace amounts.`
    : '';

  return `You are an expert kitchen assistant. Your job is to suggest 3 recipes the user can actually cook with what they have.

═══ HOW TO APPROACH THIS ═══
This is a PANTRY-FIRST task. You are NOT generating recipes and checking
if ingredients exist — you are looking at what's in the user's kitchen
and figuring out what they can make. Treat the pantry as your starting
canvas.

Before writing the JSON output, mentally:
1. Scan the pantry for protein sources, vegetables, starches, fats, and seasonings.
2. Consider the meal type and find combinations that work.
3. Each recipe should be DOMINANTLY made from pantry items.

═══ PANTRY (the user's available ingredients) ═══
${formatPantry(pantry)}

═══ USER PROFILE ═══
Name: ${profile.name || '(not set)'}
Cuisine preference: ${profile.cuisine || '(open to anything)'}
Cooking level: ${profile.level}
Servings per recipe: ${profile.servings}
Allergies & avoidances: ${profile.allergies || '(none)'}
Diet goal: ${profile.dietGoal}

═══ MEAL TYPE ═══
${MEAL_DESC[mealType]}
${dishSection}
${mustSection}${skipSection}

═══ HARD RULES (must all be satisfied) ═══

1. PANTRY DOMINANCE: In every recipe, at least 70% of the ingredients
   listed must come from the user's pantry. Set "missing": false for
   pantry items, "missing": true for items not in the pantry.

2. MISSING MINIMAL: A recipe should have at most 2-3 missing ingredients,
   and those should ideally be pantry staples (salt, pepper, common oils)
   or one main ingredient max. Never propose a recipe where the user
   would need to buy half the ingredients.

3. ALLERGIES & SKIPS: Never use anything from the user's allergies list
   or from the SKIP list above. Non-negotiable, no exceptions.

4. MUST-INCLUDE: If the user listed must-include ingredients above, ALL
   3 recipes must feature ALL of them prominently.

5. EXPIRY PRIORITY: When a pantry item is marked "expires TODAY" or
   "prefer using", weight it heavily. At least 2 of the 3 recipes should
   feature at least one such item.

6. LOOSE MATCHING: Match pantry items loosely. "chicken breast" in a
   recipe matches "chicken" in the pantry. "garlic clove" matches "garlic".
   Trust the user has reasonable substitutes for similar things.

7. COOKING LEVEL:
   - Beginner: ≤5 steps, basic techniques only (boil, fry, bake, mix)
   - Intermediate: ≤8 steps, can use marination, reduction, sauté
   - Expert: up to 12 steps, advanced techniques allowed

8. DIET GOAL:
   - "Weight loss": ≤500 kcal/serving
   - "Muscle": ≥30g protein/serving implied
   - "Health": balanced, vegetable-forward
   - "None": no constraint

9. SERVINGS: Exactly ${profile.servings} per recipe.

10. DIVERSITY: The 3 recipes should be meaningfully different (different
    proteins or cooking techniques or cuisine styles), unless must-include
    constraints force similarity.
    ${trimmedDish
      ? '\nWhen the user named a DISH IN MIND: offer three substantive variations — e.g. different technique, richness level, or regional twist — not three copies of one recipe.'
      : ''
    }

11. ${langInstruction}

═══ OUTPUT FORMAT ═══
Respond with ONLY valid JSON. No prose, no markdown, no code fences.
Strict schema:

{
  "recipes": [
    {
      "name": "string — descriptive recipe title",
      "cookTime": number — total minutes from start to plating,
      "difficulty": "Beginner" | "Intermediate" | "Expert",
      "calories": number — estimated kcal per serving,
      "ingredients": [
        {
          "name": "string",
          "amount": "string e.g. '200g' or '2 cloves'",
          "missing": boolean,
          "pantryCategory": "produce" | "protein" | "dairy" | "grains" | "pantry" | "other"
        }
      ],
      "steps": ["string — one step per array element, imperative voice"],
      "chefTips": ["string — short practical tips for best results"],
      "serving": "string — e.g. 'Serves 4' matching the user's servings preference"
    }
  ]
}

Generate the 3 recipes now.`;
}

function buildRecipePromptSpeed({
  pantry, profile, mealType, customization, dishIdea,
}: PromptInput): string {
  const trimmedDish = dishIdea?.trim();
  const langInstruction = profile.language === 'EL'
    ? 'OUTPUT LANGUAGE: Greek (Ελληνικά) for all text fields.'
    : profile.language === 'ES'
      ? 'OUTPUT LANGUAGE: Spanish (Español) for all text fields.'
      : 'OUTPUT LANGUAGE: English.';

  const mustInclude = customization?.mustInclude ?? [];
  const skip = customization?.skip ?? [];

  const mustSection = mustInclude.length > 0
    ? `\nMUST include in BOTH recipes: ${mustInclude.join(', ')}.`
    : '';
  const skipSection = skip.length > 0
    ? `\nNEVER use: ${skip.join(', ')}.`
    : '';
  const dishSection = trimmedDish
    ? `\nUser wants dishes related to: "${trimmedDish}". Both recipes must fit.`
    : '';

  const maxSteps = profile.level === 'Beginner' ? 4 : profile.level === 'Intermediate' ? 5 : 6;

  return `Suggest exactly 2 recipes the user can cook from their pantry. FAST MODE — be concise.

PANTRY:
${formatPantry(pantry)}

PROFILE: ${profile.level} cook, ${profile.servings} servings, cuisine: ${profile.cuisine || 'any'}, allergies: ${profile.allergies || 'none'}, diet: ${profile.dietGoal}.
MEAL TYPE: ${MEAL_DESC[mealType]}${dishSection}${mustSection}${skipSection}

RULES:
- ≥70% ingredients from pantry ("missing": false). At most 2 missing items per recipe.
- Prefer items expiring today or within 3 days.
- Respect allergies and skip list.
- Max ${maxSteps} steps per recipe; each step ≤120 characters.
- Max 8 ingredients per recipe.
- chefTips: 0 or 1 short tip per recipe (optional).
- Names ≤60 characters. Two different proteins or techniques.
- ${langInstruction}

JSON ONLY (no fences):
{
  "recipes": [
    {
      "name": "string",
      "cookTime": number,
      "difficulty": "Beginner" | "Intermediate" | "Expert",
      "calories": number,
      "ingredients": [{ "name": "string", "amount": "string", "missing": boolean, "pantryCategory": "produce"|"protein"|"dairy"|"grains"|"pantry"|"other" }],
      "steps": ["string"],
      "chefTips": ["string"],
      "serving": "Serves ${profile.servings}"
    }
  ]
}

Generate exactly 2 recipes now.`;
}

// ─── Vision: single product photo ────────────────────────────

export function buildProductPhotoPrompt(language: Language): string {
  const langInstruction = language === 'EL'
    ? 'Return the ingredient name in Greek (Ελληνικά).'
    : 'Return the ingredient name in English.';

  return `You are identifying a food item from a photo to add to a kitchen pantry.
${langInstruction}

Return ONLY a valid JSON object with this exact shape:
{"name":"string","amount":"string","category":"produce|protein|dairy|grains|pantry|other"}

Rules:
- name: the common ingredient name, NOT the brand name (e.g. "chicken breast" not "Drobiex filet z kurczaka")
- amount: quantity if clearly visible on packaging (e.g. "500g", "1L"), otherwise omit the field
- category: choose the single best fit:
    produce  = fresh/frozen fruit and vegetables
    protein  = meat, fish, eggs, tofu
    dairy    = milk, cheese, yogurt, butter
    grains   = pasta, rice, bread, flour, cereals, legumes
    pantry   = oils, canned goods, sauces, spices, condiments, snacks
    other    = anything that doesn't fit above

No explanation, no markdown, no code fences. Just the JSON object.`;
}

// ─── Vision: receipt photo ────────────────────────────────────

export function buildReceiptPrompt(language: Language): string {
  const langInstruction = language === 'EL'
    ? 'Return all ingredient names in Greek (Ελληνικά).'
    : 'Return all ingredient names in English.';

  return `You are parsing a supermarket receipt (possibly in Polish or another language) to extract food ingredients for a kitchen pantry.
${langInstruction}

Return ONLY valid JSON with this exact shape:
{"ingredients":[{"name":"string","amount":"string","category":"produce|protein|dairy|grains|pantry|other"}]}

Rules:
- name: common ingredient name, NOT brand name (e.g. "pasta" not "Barilla Spaghetti N.5")
- amount: quantity from the receipt if readable (e.g. "1kg", "2×"), otherwise omit the field
- category: same values as above (produce/protein/dairy/grains/pantry/other)
- SKIP non-food items: cleaning products, cosmetics, bags, household items, alcohol if unsure
- SKIP duplicates: merge into one entry with combined quantity
- Maximum 30 ingredients
- If the receipt is unreadable or has no food items, return {"ingredients":[]}

No explanation, no markdown, no code fences. Just the JSON object.`;
}

function formatPantryShort(pantry: Ingredient[]): string {
  if (pantry.length === 0) return '(empty)';
  return pantry.map(p => `- ${p.name}${p.amount ? ` [${p.amount}]` : ''}`).join('\n');
}

function profileBlock(profile: Profile): string {
  return `Name: ${profile.name || '(not set)'}
Cuisine preference: ${profile.cuisine || '(open)'}
Cooking level: ${profile.level}
Servings for this dish: ${profile.servings}
Allergies & avoidances: ${profile.allergies || '(none)'}
Diet goal: ${profile.dietGoal}`;
}

/** Goal-first dish: authentic recipe regardless of pantry; JSON shape wraps a single recipe. */
export function buildDishPrompt(dishName: string, pantry: Ingredient[], profile: Profile): string {
  const trimmed = dishName.trim();
  const langInstruction = profile.language === 'EL'
    ? 'CRITICAL OUTPUT LANGUAGE: All recipe content MUST be in Greek (Ελληνικά).'
    : profile.language === 'ES'
      ? 'CRITICAL OUTPUT LANGUAGE: All recipe content MUST be in Spanish (Español).'
      : 'Output language: English.';
  return `The user wants to cook this specific dish: "${trimmed}".

═══ USER PROFILE ═══
${profileBlock(profile)}

═══ THEIR PANTRY (context only — do NOT limit the dish to pantry; produce the REAL recipe they asked for) ═══
${formatPantryShort(pantry)}

═══ RULES ═══
1. Give a complete, authentic version of "${trimmed}" that respects allergies and diet constraints from the profile.
2. Scale amounts to ${profile.servings} servings.
3. For each ingredient, set "missing" using loose pantry name matching against the pantry list. Set "pantryCategory" when missing is true so the app can group a shopping list.
4. Include "chefTips" (2–4 short strings) and "serving" (e.g. "Serves ${profile.servings}").
5. ${langInstruction}

═══ OUTPUT (JSON ONLY, no prose, no fences) ═══
{
  "recipe": {
    "name": "string",
    "cookTime": number,
    "difficulty": "Beginner" | "Intermediate" | "Expert",
    "calories": number,
    "ingredients": [
      { "name": "string", "amount": "string", "missing": boolean,
        "pantryCategory": "produce" | "protein" | "dairy" | "grains" | "pantry" | "other" }
    ],
    "steps": ["string"],
    "chefTips": ["string"],
    "serving": "string"
  }
}`;
}

/** Plain-text substitution hints for ingredients the user lacks. */
export function buildSubstitutionPrompt(missingIngredientNames: string[], pantry: Ingredient[]): string {
  const miss = missingIngredientNames.filter(Boolean).map(s => `- ${s}`).join('\n') || '(none)';
  return `These ingredients are NOT in the user's pantry:\n${miss}

Ingredients they DO have:\n${formatPantryShort(pantry)}

Suggest the best substitutions from what they already have. If there is no reasonable substitute for an item, say "No good substitute" for that line.

Respond in plain text as a numbered or bulleted list — NOT JSON — one line per missing ingredient.

Keep it concise and practical for home cooking.`;
}
