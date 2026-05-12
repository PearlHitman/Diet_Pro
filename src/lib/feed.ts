// Feed data — TheMealDB recipe of the day, rotating food facts, and
// seasonal ingredient picks. All network results are cached in IndexedDB
// with a daily TTL so the feed loads instantly offline after first visit.

import { get, set } from 'idb-keyval';

export const FEED_KEY = 'kitchen:feed:v1';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MealOfDay {
  id: string;
  name: string;
  category: string;
  area: string;
  thumb: string;
  tags: string[];
  youtubeUrl: string | null;
  sourceUrl: string | null;
}

export interface FoodFact {
  text: string;
  icon: string;
}

export interface SeasonalPick {
  name: string;
  emoji: string;
  note: string;
}

interface FeedCache {
  date: string; // YYYY-MM-DD
  meal: MealOfDay;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

// ─── TheMealDB — recipe of the day ───────────────────────────────────────

export async function fetchMealOfDay(): Promise<MealOfDay> {
  const cached = await get<FeedCache>(FEED_KEY);
  if (cached && cached.date === todayStr()) {
    return cached.meal;
  }
  const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
  if (!res.ok) throw new Error('TheMealDB request failed');
  const data = await res.json();
  const m = data.meals?.[0];
  if (!m) throw new Error('No meal returned');
  const meal: MealOfDay = {
    id: m.idMeal,
    name: m.strMeal,
    category: m.strCategory ?? '',
    area: m.strArea ?? '',
    thumb: m.strMealThumb ?? '',
    tags: m.strTags
      ? m.strTags.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    youtubeUrl: m.strYoutube || null,
    sourceUrl: m.strSource || null,
  };
  await set(FEED_KEY, { date: todayStr(), meal });
  return meal;
}

// Force-refresh ignoring the cache (used by the manual refresh button).
export async function refreshMealOfDay(): Promise<MealOfDay> {
  const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
  if (!res.ok) throw new Error('TheMealDB request failed');
  const data = await res.json();
  const m = data.meals?.[0];
  if (!m) throw new Error('No meal returned');
  const meal: MealOfDay = {
    id: m.idMeal,
    name: m.strMeal,
    category: m.strCategory ?? '',
    area: m.strArea ?? '',
    thumb: m.strMealThumb ?? '',
    tags: m.strTags
      ? m.strTags.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    youtubeUrl: m.strYoutube || null,
    sourceUrl: m.strSource || null,
  };
  await set(FEED_KEY, { date: todayStr(), meal });
  return meal;
}

// ─── Food facts (rotating by day of year) ────────────────────────────────

const FACTS: FoodFact[] = [
  { icon: '🍯', text: 'Honey never expires. Jars found in ancient Egyptian tombs are still edible after 3,000 years.' },
  { icon: '🍎', text: 'Apples are 25% air, which is why they float in water.' },
  { icon: '🍌', text: 'Strawberries aren\'t true berries, but bananas, kiwis, and avocados are — botanically speaking.' },
  { icon: '🐝', text: 'A single teaspoon of honey represents the life\'s work of 12 bees.' },
  { icon: '🥕', text: 'Carrots were originally purple. The orange variety was cultivated by Dutch farmers in the 17th century.' },
  { icon: '🌶️', text: 'Capsaicin doesn\'t actually burn you — it tricks your pain receptors into registering heat.' },
  { icon: '🥜', text: 'Peanuts are legumes, not nuts. They\'re more closely related to beans and lentils.' },
  { icon: '🍫', text: 'Dark chocolate contains more antioxidants per gram than blueberries.' },
  { icon: '🥦', text: 'Broccoli contains more protein per calorie than steak.' },
  { icon: '🧂', text: 'The word "salary" comes from the Latin "salarium" — salt was once used to pay Roman soldiers.' },
  { icon: '🥑', text: 'Avocados ripen faster when placed next to bananas, which emit ethylene gas.' },
  { icon: '🍉', text: 'Watermelon is 92% water, making it one of the most hydrating foods you can eat.' },
  { icon: '☕', text: 'Coffee is the world\'s second most traded commodity after crude oil.' },
  { icon: '🥚', text: 'One egg contains all nine essential amino acids, making it a nutritionally complete protein.' },
  { icon: '🍅', text: 'The Maillard reaction — the browning of food when cooked — creates over 1,000 distinct flavor compounds.' },
  { icon: '🍋', text: 'Lemons contain more sugar than strawberries. Citric acid just overwhelms the sweetness on your palate.' },
  { icon: '🌿', text: 'Spinach loses up to 50% of its folate content within 8 days of harvest.' },
  { icon: '🫒', text: 'Olive oil was used as currency, medicine, and sacred oil long before it was a culinary staple.' },
  { icon: '🖤', text: 'Black pepper was so valuable in medieval Europe it was sometimes used as a form of currency.' },
  { icon: '🍄', text: 'Mushrooms produce vitamin D when exposed to sunlight — just like human skin does.' },
  { icon: '🍝', text: 'Tomatoes are 95% water, which makes them surprisingly low in calories.' },
  { icon: '🧀', text: 'Authentic Parmigiano-Reggiano must be aged at least 24 months by Italian law.' },
  { icon: '🌰', text: 'The spice saffron requires over 150,000 crocus flowers to produce just one kilogram.' },
  { icon: '🌾', text: 'Oats are the only grain containing significant beta-glucan — the soluble fiber linked to lower cholesterol.' },
  { icon: '🍊', text: 'Limes were issued to British sailors to prevent scurvy, giving rise to the slang "limey."' },
  { icon: '🧬', text: 'Green, yellow, and red bell peppers are the same plant — just at different stages of ripeness.' },
  { icon: '💛', text: 'Turmeric\'s active compound, curcumin, has been studied for powerful anti-inflammatory effects.' },
  { icon: '🌱', text: 'One cup of lentils provides as much protein as three eggs and more fiber than most grains.' },
  { icon: '🌍', text: 'Quinoa is one of the few plant foods that contains all nine essential amino acids.' },
  { icon: '🧪', text: 'Fermentation was discovered over 10,000 years ago — bread, beer, and wine predate written history.' },
  { icon: '🍵', text: 'Kombucha is fermented tea with origins in northeast China dating back to 220 BCE.' },
  { icon: '🍫', text: 'Cacao trees only grow within 20° of the equator — all chocolate originates from a narrow tropical band.' },
  { icon: '🥝', text: 'Kiwi fruit contains more vitamin C per gram than oranges.' },
  { icon: '🫐', text: 'A handful of blueberries provides nearly 25% of your recommended daily vitamin C.' },
  { icon: '🧄', text: 'Garlic and onions are both alliums and share many of the same sulfur compounds that make them so healthful.' },
  { icon: '🐟', text: 'Wild salmon gets its pink color from eating krill and shrimp rich in astaxanthin, a powerful antioxidant.' },
  { icon: '🍞', text: 'Sourdough fermentation breaks down phytic acid in grains, making minerals like zinc and iron more bioavailable.' },
  { icon: '🥣', text: 'Ancient Romans made garum — a fermented fish sauce — that predates Worcestershire and fish sauce by centuries.' },
  { icon: '🌮', text: 'Corn (maize) was first domesticated in Mexico around 9,000 years ago from a wild grass called teosinte.' },
  { icon: '🫚', text: 'Extra-virgin olive oil can withstand cooking temperatures up to 210 °C before its beneficial compounds degrade.' },
  { icon: '🍇', text: 'Resveratrol, the compound in red wine and grapes, is produced by the plant as a defense against fungal infection.' },
  { icon: '🥩', text: 'Wagyu beef\'s rich marbling comes from a higher ratio of monounsaturated fat — the same kind found in olive oil.' },
  { icon: '🌻', text: 'Sunflower seeds are one of the richest plant sources of vitamin E, a fat-soluble antioxidant.' },
  { icon: '🫘', text: 'Chickpeas have been cultivated for over 7,500 years — they\'re one of humanity\'s oldest cultivated legumes.' },
];

export function getFoodFact(): FoodFact {
  return FACTS[dayOfYear() % FACTS.length];
}

// ─── Seasonal picks (by calendar month) ──────────────────────────────────

const SEASONAL: Record<number, SeasonalPick[]> = {
  0: [ // January
    { name: 'Blood orange',   emoji: '🍊', note: 'Peak season — vivid, sweet-tart' },
    { name: 'Celeriac',       emoji: '🌱', note: 'Hearty and perfect for soups' },
    { name: 'Leeks',          emoji: '🥬', note: 'Mild, sweet — ideal for braises' },
    { name: 'Kale',           emoji: '🥦', note: 'Cold makes it sweeter' },
    { name: 'Parsnips',       emoji: '🌾', note: 'Nutty flavor peaks after frost' },
    { name: 'Pomelo',         emoji: '🍋', note: 'Citrus at its freshest' },
  ],
  1: [ // February
    { name: 'Citrus',         emoji: '🍊', note: 'Clementines, mandarins, grapefruits' },
    { name: 'Radicchio',      emoji: '🔴', note: 'Bitter leaves, great with balsamic' },
    { name: 'Cauliflower',    emoji: '🥦', note: 'Versatile star of winter cooking' },
    { name: 'Brussels sprouts', emoji: '🥬', note: 'Sweeter after the cold' },
    { name: 'Endive',         emoji: '🌿', note: 'Crisp, slightly bitter, great raw' },
    { name: 'Turnips',        emoji: '🌾', note: 'Earthy and sweet when roasted' },
  ],
  2: [ // March
    { name: 'Asparagus',      emoji: '🌿', note: 'First spears of the year' },
    { name: 'Artichokes',     emoji: '💚', note: 'Spring brings the best crop' },
    { name: 'Spring peas',    emoji: '💚', note: 'Sweetest eaten fresh' },
    { name: 'Green garlic',   emoji: '🧄', note: 'Mild, fresh, fleeting season' },
    { name: 'Spinach',        emoji: '🥬', note: 'Tender spring leaves' },
    { name: 'Leeks',          emoji: '🌾', note: 'End of winter, still excellent' },
  ],
  3: [ // April
    { name: 'Asparagus',      emoji: '🌿', note: 'Prime time — use it while it lasts' },
    { name: 'Radishes',       emoji: '🔴', note: 'Crisp, peppery, perfect raw' },
    { name: 'Spring onions',  emoji: '🌱', note: 'Subtle sweetness, great grilled' },
    { name: 'Watercress',     emoji: '🥬', note: 'Peppery, nutrient-dense' },
    { name: 'New potatoes',   emoji: '🥔', note: 'Thin skin, waxy, delicate' },
    { name: 'Morel mushrooms', emoji: '🍄', note: 'Rare and intensely flavored' },
  ],
  4: [ // May
    { name: 'Strawberries',   emoji: '🍓', note: 'First of the season — vivid and sweet' },
    { name: 'Broad beans',    emoji: '💚', note: 'Best when young and tender' },
    { name: 'Peas',           emoji: '🟢', note: 'Sweet freshness straight from the pod' },
    { name: 'Rocket',         emoji: '🌿', note: 'Peppery and at its best' },
    { name: 'New potatoes',   emoji: '🥔', note: 'Creamy texture, delicate flavor' },
    { name: 'Elderflower',    emoji: '🌸', note: 'Brief window for cordials & syrups' },
  ],
  5: [ // June
    { name: 'Courgettes',     emoji: '🥒', note: 'Prolific and versatile' },
    { name: 'Tomatoes',       emoji: '🍅', note: 'Outdoor-grown just starting' },
    { name: 'Cherries',       emoji: '🍒', note: 'Fleeting — don\'t miss them' },
    { name: 'Basil',          emoji: '🌿', note: 'Peak fragrance in summer heat' },
    { name: 'Cucumber',       emoji: '🥒', note: 'Cool and crisp' },
    { name: 'Fennel',         emoji: '💚', note: 'Anise sweetness at its finest' },
  ],
  6: [ // July
    { name: 'Heirloom tomatoes', emoji: '🍅', note: 'Peak summer — eat them raw' },
    { name: 'Peaches',        emoji: '🍑', note: 'Sun-warmed sweetness' },
    { name: 'Sweet corn',     emoji: '🌽', note: 'Best eaten the same day picked' },
    { name: 'Blueberries',    emoji: '🫐', note: 'Antioxidant-rich, peak flavor' },
    { name: 'Aubergine',      emoji: '🍆', note: 'Meaty, perfect on the grill' },
    { name: 'Courgette flowers', emoji: '🌻', note: 'Stuff them, fry them, eat fast' },
  ],
  7: [ // August
    { name: 'Peppers',        emoji: '🫑', note: 'Sweetest in summer heat' },
    { name: 'Melon',          emoji: '🍈', note: 'Fragrant at its peak' },
    { name: 'Figs',           emoji: '🟣', note: 'A short, luscious season' },
    { name: 'Green beans',    emoji: '💚', note: 'Tender and fresh' },
    { name: 'Late tomatoes',  emoji: '🍅', note: 'Last of the outdoor crop' },
    { name: 'Plums',          emoji: '🟣', note: 'Great for jam, tarts, and eating fresh' },
  ],
  8: [ // September
    { name: 'Apples',         emoji: '🍎', note: 'Early varieties just arriving' },
    { name: 'Pears',          emoji: '🍐', note: 'Buttery and ripe' },
    { name: 'Grapes',         emoji: '🍇', note: 'Harvest season in full swing' },
    { name: 'Butternut squash', emoji: '🎃', note: 'Sweet, nutty, stores well' },
    { name: 'Wild mushrooms', emoji: '🍄', note: 'Cep, chanterelle — forage season' },
    { name: 'Sweetcorn',      emoji: '🌽', note: 'End of season — catch it now' },
  ],
  9: [ // October
    { name: 'Pumpkin',        emoji: '🎃', note: 'Peak season — not just decoration' },
    { name: 'Apples',         emoji: '🍎', note: 'Dozens of varieties at their best' },
    { name: 'Chestnuts',      emoji: '🌰', note: 'Roast them, purée them, eat them fresh' },
    { name: 'Beetroot',       emoji: '🔴', note: 'Earthy sweetness great roasted or raw' },
    { name: 'Quince',         emoji: '🟡', note: 'Fragrant — cook before eating' },
    { name: 'Pears',          emoji: '🍐', note: 'Conference, Williams at peak' },
  ],
  10: [ // November
    { name: 'Parsnips',       emoji: '🌾', note: 'Sweetened by the first frost' },
    { name: 'Pomegranate',    emoji: '🔴', note: 'Jewel-like seeds, tart and vibrant' },
    { name: 'Leeks',          emoji: '🥬', note: 'Long season just starting' },
    { name: 'Celeriac',       emoji: '🌱', note: 'Underrated root — great remoulade' },
    { name: 'Brussels sprouts', emoji: '💚', note: 'Best after cold weather hits' },
    { name: 'Turnips',        emoji: '🟣', note: 'Earthy and sweet when slow-cooked' },
  ],
  11: [ // December
    { name: 'Kale',           emoji: '🥦', note: 'Cold-weather kale is the sweetest' },
    { name: 'Citrus',         emoji: '🍊', note: 'Oranges, satsumas — peak season' },
    { name: 'Brussels sprouts', emoji: '💚', note: 'Classic for a reason' },
    { name: 'Celeriac',       emoji: '🌱', note: 'Versatile and deeply savory' },
    { name: 'Pears',          emoji: '🍐', note: 'Late varieties still going strong' },
    { name: 'Red cabbage',    emoji: '🔴', note: 'Braises beautifully with spice' },
  ],
};

const SEASON_LABELS: Record<number, string> = {
  0: 'Winter', 1: 'Winter', 2: 'Spring', 3: 'Spring',
  4: 'Spring', 5: 'Summer', 6: 'Summer', 7: 'Summer',
  8: 'Autumn', 9: 'Autumn', 10: 'Autumn', 11: 'Winter',
};

export function getSeasonalPicks(): { season: string; picks: SeasonalPick[] } {
  const month = new Date().getMonth();
  return {
    season: SEASON_LABELS[month],
    picks: SEASONAL[month] ?? [],
  };
}
