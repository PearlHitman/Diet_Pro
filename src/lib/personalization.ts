// Personalization — time-aware greetings, cuisine flags, smart pantry alerts.
// Self-contained: no external time-of-day module needed.

import type { Language } from './types';

// ─── Time of day (local utility) ─────────────────────────────

export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'night';

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 6  && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'midday';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

// Emoji at end of greeting line. Empty for evening (Καλησπέρα reads well alone).
export const TIME_EMOJI: Record<TimeOfDay, string> = {
  morning: '🌅',
  midday:  '☀️',
  evening: '',
  night:   '🌙',
};

// ─── Greetings (i18n-aware) ──────────────────────────────────

const GREETINGS: Record<Language, Record<TimeOfDay, string>> = {
  EL: {
    morning: 'Καλημέρα',
    midday:  'Γεια σου',
    evening: 'Καλησπέρα',
    night:   'Όψιμη πείνα;',
  },
  EN: {
    morning: 'Good morning',
    midday:  'Hi',
    evening: 'Good evening',
    night:   'Late hunger?',
  },
  ES: {
    morning: 'Buenos días',
    midday:  'Hola',
    evening: 'Buenas tardes',
    night:   '¿Hambre a estas horas?',
  },
};

const SUBTITLES: Record<Language, Record<TimeOfDay, string>> = {
  EL: {
    morning: 'Τι λες για πρωινό;',
    midday:  'Ώρα για μεσημεριανό;',
    evening: 'Τι θα κάνουμε για βραδινό;',
    night:   'Κάτι ελαφρύ ίσως;',
  },
  EN: {
    morning: 'How about breakfast?',
    midday:  'Lunchtime ideas?',
    evening: "What's for dinner?",
    night:   'Something light?',
  },
  ES: {
    morning: '¿Qué tal un desayuno?',
    midday:  '¿Ideas para comer?',
    evening: '¿Qué hay para cenar?',
    night:   '¿Algo ligero?',
  },
};

export function greeting(
  name: string,
  language: Language,
  tod: TimeOfDay,
): { line: string; subtitle: string } {
  const base = GREETINGS[language][tod];
  // "Όψιμη πείνα;" sounds weird with a name appended.
  const line = tod === 'night' || !name ? base : `${base}, ${name}`;
  return { line, subtitle: SUBTITLES[language][tod] };
}

// ─── Cuisine flag/emoji badge (#6) ───────────────────────────
// Loose matching against free-text cuisine input.

const CUISINE_FLAGS: { match: RegExp; flag: string }[] = [
  { match: /mediterran|μεσογ/i,            flag: '🌊' },
  { match: /greek|ελλην/i,                 flag: '🇬🇷' },
  { match: /italian|ιταλ/i,                flag: '🇮🇹' },
  { match: /french|γαλλ/i,                 flag: '🇫🇷' },
  { match: /spanish|ισπαν/i,               flag: '🇪🇸' },
  { match: /mexican|μεξικ/i,               flag: '🇲🇽' },
  { match: /japanese|ιαπων/i,              flag: '🇯🇵' },
  { match: /chinese|κιν[έε]?ζ/i,           flag: '🇨🇳' },
  { match: /korean|κορε/i,                 flag: '🇰🇷' },
  { match: /thai|τα[ϊι]λαν/i,              flag: '🇹🇭' },
  { match: /indian|ινδ/i,                  flag: '🇮🇳' },
  { match: /turk|τουρκ/i,                  flag: '🇹🇷' },
  { match: /middle east|μέση ανατολ/i,     flag: '🥙' },
  { match: /asian|ασιατ/i,                 flag: '🥢' },
  { match: /american|αμερικ/i,             flag: '🇺🇸' },
  { match: /vegetarian|χορτοφαγ/i,         flag: '🥗' },
  { match: /vegan/i,                       flag: '🌱' },
];

export function cuisineFlag(cuisine: string): string {
  if (!cuisine) return '';
  for (const { match, flag } of CUISINE_FLAGS) {
    if (match.test(cuisine)) return flag;
  }
  return '🍳'; // fallback
}
