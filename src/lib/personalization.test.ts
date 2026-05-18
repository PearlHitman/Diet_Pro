// Tests for personalization logic — time-of-day buckets, localized
// greetings, and cuisine flag matching. All pure functions.

import { describe, it, expect } from 'vitest';
import { getTimeOfDay, greeting, cuisineFlag } from './personalization';

// Helper: a Date fixed at a given hour (date itself is irrelevant).
function atHour(h: number): Date {
  return new Date(2026, 0, 1, h, 0, 0);
}

describe('getTimeOfDay', () => {
  it('buckets the morning hours', () => {
    expect(getTimeOfDay(atHour(6))).toBe('morning');
    expect(getTimeOfDay(atHour(10))).toBe('morning');
  });

  it('buckets midday', () => {
    expect(getTimeOfDay(atHour(11))).toBe('midday');
    expect(getTimeOfDay(atHour(16))).toBe('midday');
  });

  it('buckets the evening', () => {
    expect(getTimeOfDay(atHour(17))).toBe('evening');
    expect(getTimeOfDay(atHour(21))).toBe('evening');
  });

  it('buckets late-night and pre-dawn hours as night', () => {
    expect(getTimeOfDay(atHour(23))).toBe('night');
    expect(getTimeOfDay(atHour(2))).toBe('night');
  });
});

describe('greeting', () => {
  it('appends the name for non-night greetings', () => {
    expect(greeting('Iraklis', 'EN', 'morning').line).toBe('Good morning, Iraklis');
  });

  it('omits the name at night (reads oddly with a name appended)', () => {
    expect(greeting('Iraklis', 'EN', 'night').line).toBe('Late hunger?');
  });

  it('omits the comma when no name is set', () => {
    expect(greeting('', 'EN', 'morning').line).toBe('Good morning');
  });

  it('respects the chosen language', () => {
    expect(greeting('Maria', 'ES', 'morning').line).toBe('Buenos días, Maria');
    expect(greeting('Maria', 'EL', 'morning').line).toBe('Καλημέρα, Maria');
  });

  it('returns a subtitle alongside the line', () => {
    expect(greeting('Iraklis', 'EN', 'evening').subtitle).toBeTruthy();
  });
});

describe('cuisineFlag', () => {
  it('matches well-known cuisines (English)', () => {
    expect(cuisineFlag('Italian')).toBe('🇮🇹');
    expect(cuisineFlag('Japanese')).toBe('🇯🇵');
  });

  it('matches cuisines written in Greek', () => {
    expect(cuisineFlag('ελληνική')).toBe('🇬🇷');
  });

  it('returns an empty string for empty input', () => {
    expect(cuisineFlag('')).toBe('');
  });

  it('falls back to a generic icon for unrecognized cuisines', () => {
    expect(cuisineFlag('Klingon fusion')).toBe('🍳');
  });
});
