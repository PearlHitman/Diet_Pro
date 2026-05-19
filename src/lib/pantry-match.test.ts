// Tests for pantryMatchesName — the fuzzy lookup that decides whether a
// recipe ingredient counts as "owned" or "missing". Regressing this
// regresses every "missing ingredients" badge in the UI and the
// shopping-list grouping.

import { describe, it, expect } from 'vitest';
import { pantryMatchesName } from './pantry-match';
import type { Ingredient } from './types';

function ing(name: string): Ingredient {
  return {
    id: name,
    name,
    category: 'other',
    expiresOn: null,
    addedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('pantryMatchesName', () => {
  it('matches an exact case-insensitive name', () => {
    expect(pantryMatchesName([ing('Olive Oil')], 'olive oil')).toBe(true);
    expect(pantryMatchesName([ing('olive oil')], 'OLIVE OIL')).toBe(true);
  });

  it('matches when the pantry item is a substring of the recipe name', () => {
    // Pantry: "chickpeas"; recipe asks for "canned chickpeas".
    expect(pantryMatchesName([ing('chickpeas')], 'canned chickpeas')).toBe(true);
  });

  it('matches when the recipe name is a substring of the pantry item', () => {
    // Pantry: "extra virgin olive oil"; recipe asks for "olive oil".
    expect(pantryMatchesName([ing('extra virgin olive oil')], 'olive oil')).toBe(true);
  });

  it('returns false when nothing overlaps', () => {
    expect(pantryMatchesName([ing('flour'), ing('milk')], 'chickpeas')).toBe(false);
  });

  it('returns false for an empty pantry', () => {
    expect(pantryMatchesName([], 'anything')).toBe(false);
  });

  it('returns false for an empty recipe ingredient name', () => {
    expect(pantryMatchesName([ing('flour')], '')).toBe(false);
    expect(pantryMatchesName([ing('flour')], '   ')).toBe(false);
  });

  it('ignores pantry items with empty/whitespace names', () => {
    expect(pantryMatchesName([ing('   '), ing('flour')], 'flour')).toBe(true);
    expect(pantryMatchesName([ing('')], 'flour')).toBe(false);
  });

  it('trims whitespace on both sides', () => {
    expect(pantryMatchesName([ing('  flour  ')], '  flour  ')).toBe(true);
  });

  it('finds a hit even when only one of many pantry items matches', () => {
    const pantry = [ing('milk'), ing('eggs'), ing('butter'), ing('chickpeas')];
    expect(pantryMatchesName(pantry, 'chickpeas')).toBe(true);
  });
});
