# Kitchen Assistant — Full Product & UI Context

## 1. PRODUCT OVERVIEW

**Name:** Kitchen Assistant
**Type:** Web app (responsive, mobile-first)
**Goal:** Help users cook by suggesting recipes based on ingredients they already own.
**Core value:** "Tell me what you have → get 3 personalized recipes powered by AI."

**Target user:** Someone who often forgets what's in the fridge, doesn't know what to cook, and wants quick, tasty meals tailored to their pantry, preferences, and dietary goals.

**Primary cuisine focus:** Greek / Mediterranean (but customizable per user).

---

## 2. CORE FUNCTIONALITY

### 2.1 Pantry (Ingredient Storage)
- Users add ingredients organized into **6 categories**:
  1. Vegetables (Λαχανικά)
  2. Meat & Fish (Κρέατα & Ψάρια)
  3. Dairy (Γαλακτοκομικά)
  4. Grains & Legumes (Δημητριακά & Όσπρια)
  5. Spices (Μπαχαρικά)
  6. Other (Άλλα)
- Each ingredient stores: **name** (required), **quantity** (optional), **expiry date** (optional), **category**.
- Visual indicators for expiry status:
  - **Expired** → red
  - **Expires within 3 days** → amber/orange
  - **OK** → neutral

### 2.2 User Profile (single user for now)
- Name
- Preferred cuisine (default: Greek/Mediterranean, editable text)
- Number of servings (1–20)
- Cooking level: Beginner / Intermediate / Expert
- Allergies / foods to avoid (optional text)
- Diet goal: None / Weight loss / Muscle gain / Health

### 2.3 Recipe Generation
- User taps a primary CTA "Generate Recipe"
- A **modal pops up first** asking the meal type:
  - ⚡ Quick (under 30 min)
  - 🥗 Healthy
  - 🍲 Comfort food
  - 🎉 Festive
- App sends pantry + profile + meal type to Claude API
- Returns **exactly 3 recipes**, each containing:
  - Recipe name
  - Cooking time (minutes)
  - Difficulty (Easy/Medium/Hard)
  - Approximate calories per serving
  - Ingredient list (each marked as "owned" or "missing")
  - Step-by-step instructions
  - Chef tips
  - Serving suggestion
- **Rule:** Recipes prioritize ingredients the user already owns. Max 1–2 extra missing ingredients allowed, clearly flagged.

### 2.4 History & Favorites
- All generated recipes are saved to history automatically (max 50)
- User can star ⭐ any recipe to add to favorites
- Separate views for History and Favorites

### 2.5 Bilingual Support
- Greek (default) and English
- Toggle in the top-right of the header
- All UI text translated; recipe content generated in the user's selected language

### 2.6 Persistence
- All data (pantry, profile, history, favorites, language) persists across sessions
- Currently using browser-based key-value storage; will migrate to database in Phase 2

---

## 3. SCREENS / VIEWS

### 3.1 Home Screen
- Personalized greeting: "Welcome, [Name] 👋"
- Subtitle: "Tell me what you have and I'll create a recipe"
- **Primary CTA** (large, prominent): "Generate Recipe" with sparkle icon
- **4 stat cards** in a 2x2 grid:
  - Pantry count → links to Pantry
  - Favorites count → links to Favorites
  - History count → links to History
  - Profile name → links to Profile
- **Expiry warning section** (only if items expiring soon or expired): amber-tinted card listing up to 3 items with their expiry dates

### 3.2 Pantry Screen
- Title + "Add" button in header row
- **Horizontal scrollable category tabs** (pill-shaped)
  - Active tab highlighted with brand accent color
  - Count badge next to each category name
- **List of ingredients** for the active category:
  - Name (bold)
  - Quantity + expiry date (muted, smaller)
  - Delete icon (with 2-step confirmation: Yes/No inline)
- Empty state: centered muted text "Empty - add ingredients"

### 3.3 Add Ingredient Modal
- Modal with form fields:
  - Name (text, required, autofocus)
  - Quantity (text, optional — e.g., "500g", "2 pcs")
  - Expiry (date picker, optional)
  - Category (dropdown)
- Two buttons: Cancel + Add

### 3.4 Profile Screen
- Form with all profile fields
- Inputs styled consistently
- Saves automatically on change (no save button needed)

### 3.5 Recipe Generation Flow
1. **Meal type modal** appears after tapping CTA
   - Title + subtitle showing ingredient count
   - 2x2 grid of large buttons with emojis
2. **Loading state** while AI generates:
   - Spinning loader (brand color)
   - "Generating recipes..." text
3. **Recipe results** screen displaying 3 recipe cards

### 3.6 Recipe Card
- Recipe name (large, bold)
- Star toggle (favorite) in top-right
- **Meta row**: ⏱️ time · 📊 difficulty · 🔥 ~calories kcal
- **Sections** (each with small uppercase header in accent color):
  - Ingredients (bulleted; missing items highlighted in amber with "(Missing)" tag)
  - Steps (numbered)
  - 👨‍🍳 Chef tips (italic)
  - 🍽️ Serving suggestion

### 3.7 History Screen
- List of all past recipe cards (reverse chronological)
- Empty state: "You haven't generated recipes yet"

### 3.8 Favorites Screen
- List of starred recipes
- Empty state: "No favorites yet"

---

## 4. NAVIGATION

- **Single-page app** with view switching (no routing necessary)
- **Header is sticky** with:
  - Back arrow (only when not on home)
  - App icon (chef hat) + name
  - Language toggle (EL/EN)
- **No bottom nav** — navigation from the home stat cards and back button

---

## 5. DESIGN SYSTEM

### 5.1 Color Palette (Dark, Modern, Mediterranean-inspired)
| Token | Hex | Use |
|---|---|---|
| Background gradient | `#0a0a0f` → `#14141c` | Main app background |
| Surface | `rgba(255,255,255,0.03)` | Cards, list items |
| Surface elevated | `#1a1a22` | Modals |
| Border subtle | `rgba(255,255,255,0.06)` | Card borders, dividers |
| Border accent | `rgba(212,165,116,0.5)` | Active tabs, focus rings |
| Text primary | `#e8e8ee` | Body text |
| Text secondary | `#a0a0aa` | Labels, captions |
| Text muted | `#8a8a96` / `#6a6a72` | Empty states, hints |
| **Accent (primary)** | `#d4a574` | CTAs, active states, highlights |
| Accent gradient | `linear-gradient(135deg, #d4a574 0%, #b88a5a 100%)` | Primary buttons |
| Warning | `#fbbf24` / `rgba(245,158,11,0.x)` | Expiring soon, missing ingredients |
| Danger | `#f87171` | Expired items, delete |

**Note:** Accent is a warm Mediterranean gold/terracotta — evokes olive oil, baked bread, sunset.

### 5.2 Typography
- Font: System UI stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Display headings: 28px / 700 / -0.02em letter-spacing
- Section titles: 22px / 700 / -0.01em
- Recipe names: 18px / 600
- Body: 14px / 400 / 1.6–1.7 line-height
- Labels: 12px / 500 / uppercase (for section headers inside cards) with 0.05em letter-spacing
- Captions: 12px / 400 / muted

### 5.3 Spacing & Layout
- Max content width: 720px (centered)
- Page padding: 20px
- Card padding: 16–20px
- Gap between cards: 12–16px
- Border radius: 10px (inputs), 12px (cards small), 14–16px (cards large, modals)
- Pill border radius: 999px

### 5.4 Components
- **Buttons:**
  - Primary: solid accent background, dark text, bold
  - Secondary: subtle white-tint background, light text
  - Icon: transparent, muted color, padded square
- **Cards:** subtle background with thin border (no heavy shadows; rely on background contrast)
- **Modals:** centered, max-width 420px, backdrop blur, surface-elevated background
- **Inputs:** dark surface, subtle border, accent-colored focus border, 14px font
- **Pill tabs:** rounded-full, active state uses accent tint background + accent border + accent text

### 5.5 Iconography
- Use `lucide-react` icon set throughout
- Icons used: ChefHat, Plus, Sparkles, User, BookOpen, Star, Trash2, ArrowLeft, Loader2, Globe, Calendar, Package, Heart
- Icon size: 14–22px depending on context

### 5.6 Motion / Interactions
- Button press: `transform: scale(0.98)` on `:active`
- Smooth transitions: 0.15s ease on all interactive elements
- Loading spinner: 1s linear infinite rotation
- Modal backdrop: 0.6 opacity black + 8px backdrop blur
- Header: blur backdrop for glass effect

### 5.7 Tone
- Modern, minimal, premium feel — closer to Linear or Things 3 than to typical food apps
- Generous whitespace
- Avoids skeuomorphic food imagery
- Single hero color (warm gold) against deep neutral background
- Emojis used sparingly for warmth (meal type icons, section headers)

---

## 6. AI INTEGRATION SPEC

### 6.1 API
- Provider: Anthropic Claude API
- Model: `claude-sonnet-4-20250514` (or latest available)
- Endpoint: `https://api.anthropic.com/v1/messages`
- max_tokens: 3000

### 6.2 Prompt Structure
The prompt sent to Claude includes:
1. Role: experienced chef specialized in [user's preferred cuisine]
2. List of ingredients with quantities
3. User profile (name, cuisine, servings, level, allergies, goal)
4. Meal type selected
5. Strict rules:
   - Prioritize existing ingredients; max 1–2 extras
   - Strictly avoid allergies
   - Approximate calories per serving
   - Adapt difficulty to user level
6. Required JSON output schema (no markdown, no explanations)

### 6.3 Response Schema
```json
{
  "recipes": [
    {
      "name": "string",
      "cookTime": 30,
      "difficulty": "Easy|Medium|Hard",
      "calories": 450,
      "ingredients": [
        { "name": "string", "amount": "string", "missing": false }
      ],
      "steps": ["string", "string", "..."],
      "chefTips": "string",
      "serving": "string"
    }
  ]
}
```

---

## 7. DATA MODEL

### 7.1 Pantry Item
```typescript
{
  id: number,           // timestamp
  name: string,
  quantity: string,     // optional
  expiry: string,       // ISO date, optional
  category: "vegetables" | "meat" | "dairy" | "grains" | "spices" | "other"
}
```

### 7.2 Profile
```typescript
{
  name: string,
  cuisine: string,
  servings: number,
  level: "beginner" | "intermediate" | "expert",
  allergies: string,
  goal: "none" | "weightLoss" | "muscle" | "health"
}
```

### 7.3 Recipe (after generation)
```typescript
{
  id: number,
  name: string,
  cookTime: number,
  difficulty: string,
  calories: number,
  ingredients: [{ name, amount, missing }],
  steps: string[],
  chefTips: string,
  serving: string,
  mealType: "quick" | "healthy" | "comfort" | "festive",
  createdAt: string  // ISO timestamp
}
```

---

## 8. CURRENT SCOPE (Phase 1 — MVP)

✅ Pantry with categories, quantity, expiry
✅ User profile with preferences
✅ AI recipe generation (3 recipes per request)
✅ Meal type selection
✅ History (max 50)
✅ Favorites
✅ Bilingual (EL/EN)
✅ Dark theme, responsive layout
✅ Persistent storage

## 9. ROADMAP (Phase 2 — future)

- 📷 Barcode/camera scanning for fast pantry input
- 🔔 Push notifications for expiring items
- 📅 Weekly meal planner
- 👥 Multi-user support with auth
- 🛒 Auto-generated shopping list from missing ingredients
- 📊 Export recipes to PDF
- 🏷️ Smart suggestions based on history
- 🍷 Wine/drink pairing suggestions

---

## 10. KEY UX PRINCIPLES

1. **Frictionless adding:** users add ingredients in seconds, no required fields beyond name
2. **One primary action:** the home screen has ONE big button. Everything else is secondary
3. **Forgiveness:** confirm before destructive actions (delete)
4. **No empty stares:** every empty state has helpful guidance
5. **Awareness:** expiring items surface automatically on home
6. **Personalization compounds:** more profile data = better recipes; show value of filling out profile
7. **Speed:** all reads instant (local), only AI call has loading state
8. **Visual hierarchy:** accent color reserved for the single most important action on each screen

---

## 11. NOTES FOR THE UI DESIGNER

- Mobile-first but works on desktop up to 720px width
- Avoid stock food photography — too generic
- The aesthetic target is: imagine if Linear or Notion made a cooking app
- Greek users are primary, so Greek text length must be accommodated (often longer than English equivalents)
- Recipe cards are the "hero content" — they should feel beautiful to read
- The amber color for "missing ingredient" / "expiring soon" creates a consistent visual language for "needs attention"
- No need for sound effects, animations beyond simple transitions
- Accessibility: ensure contrast ratios pass WCAG AA on dark theme (current palette tested OK)
