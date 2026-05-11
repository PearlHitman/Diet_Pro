// Prompt construction for recipe generation.
// Edit here when you want to tune the AI's behavior — don't scatter
// prompts across the codebase.

import type { Ingredient, Language, MealType, Profile } from './types';

// ─── Meal type descriptions (used in prompt) ─────────────────

const MEAL_DESC: Record<MealType, string> = {
  quick:    'Quick meal — should be ready in under 30 minutes, minimal active cooking.',
  healthy:  'Healthy & light — lean proteins, vegetables, balanced macros, lower calorie.',
  comfort:  'Comfort food — hearty, warming, satisfying. Higher calorie is fine.',
  festive:  'Festive — impressive presentation, suitable for sharing or special occasions.',
};

// ─── Helpers ─────────────────────────────────────────────────

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const expiry = new Date(isoDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ms = expiry.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

function formatPantry(pantry: Ingredient[]): string {
  if (pantry.length === 0) return '(pantry is empty)';
  return pantry
    .map(it => {
      const days = daysUntil(it.expiresOn);
      let suffix = '';
      if (days !== null) {
        if (days < 0)      suffix = ` (EXPIRED ${-days}d ago)`;
        else if (days === 0) suffix = ' (expires TODAY)';
        else if (days <= 3)  suffix = ` (expires in ${days}d — USE SOON)`;
        else                 suffix = ` (expires in ${days}d)`;
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
}

export function buildRecipePrompt({ pantry, profile, mealType }: PromptInput): string {
  const langInstruction = profile.language === 'EL'
    ? 'CRITICAL: Generate ALL text content in Greek (Ελληνικά). Recipe names, ingredient names, and cooking steps must be in Greek. Numbers and units stay as-is.'
    : 'Generate all content in English.';

  return `You are an expert kitchen assistant. Generate EXACTLY 3 distinct recipes using the user's pantry and profile.

═══ PANTRY ═══
${formatPantry(pantry)}

═══ USER PROFILE ═══
Name: ${profile.name || '(not set)'}
Cuisine preference: ${profile.cuisine || '(open to anything)'}
Cooking level: ${profile.level}
Servings: ${profile.servings}
Allergies & avoidances: ${profile.allergies || '(none)'}
Diet goal: ${profile.dietGoal}

═══ MEAL TYPE ═══
${MEAL_DESC[mealType]}

═══ RULES (strict) ═══
1. PRIORITIZE ingredients marked "USE SOON" or "expires TODAY". At least 2 of the 3 recipes should feature these.
2. NEVER include ingredients the user is allergic to. This is non-negotiable.
3. For each recipe ingredient, set "missing": true if it is NOT in the user's pantry; false otherwise. Match loosely (e.g. "chicken breast" matches a pantry entry of "chicken"). Aim for low-missing recipes when possible, but a good recipe with 2-3 missing ingredients is better than a bad recipe with zero.
4. Match cooking level:
   - Beginner: ≤5 steps, basic techniques only (boil, fry, bake)
   - Intermediate: ≤8 steps, can use techniques like reduction, marination
   - Expert: up to 12 steps, advanced techniques allowed
5. Respect diet goal:
   - "Weight loss": ≤500 kcal/serving, lean
   - "Muscle": high protein, ≥30g protein/serving implied
   - "Health": balanced, vegetable-forward
   - "None": no constraint
6. Servings per recipe must equal ${profile.servings}.
7. Make the 3 recipes meaningfully different (different proteins, techniques, or styles).
8. ${langInstruction}

═══ OUTPUT FORMAT ═══
Respond with ONLY valid JSON. No prose, no markdown, no code fences. Schema:

{
  "recipes": [
    {
      "name": "string — descriptive recipe title",
      "cookTime": number — total minutes from start to plating,
      "difficulty": "Beginner" | "Intermediate" | "Expert",
      "calories": number — estimated kcal per serving,
      "ingredients": [
        { "name": "string", "amount": "string e.g. '200g' or '2 cloves'", "missing": boolean }
      ],
      "steps": ["string — one step per array element, imperative voice"]
    }
  ]
}

Generate the 3 recipes now.`;
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
