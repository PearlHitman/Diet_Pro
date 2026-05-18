// Tests for the functions that guard untrusted AI output.
// `parseJsonLoose` and `isValidAIResponse` decide whether we trust what
// Claude sent back — if they regress, malformed data reaches the UI.

import { describe, it, expect } from 'vitest';
import { parseJsonLoose, isValidAIResponse, ClaudeError } from './claude';
import type { AIResponse } from './types';

// A minimal valid recipe the validator should accept.
const validRecipe = {
  name: 'Harissa-Braised Chickpeas',
  cookTime: 25,
  difficulty: 'Intermediate' as const,
  calories: 420,
  ingredients: [{ name: 'chickpeas', amount: '400g', missing: false }],
  steps: ['Warm the harissa in oil.', 'Add chickpeas and braise 20 min.'],
};

describe('parseJsonLoose', () => {
  it('parses a plain JSON object', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json code fences', () => {
    const text = '```json\n{"recipes":[]}\n```';
    expect(parseJsonLoose(text)).toEqual({ recipes: [] });
  });

  it('strips bare ``` code fences', () => {
    const text = '```\n{"ok":true}\n```';
    expect(parseJsonLoose(text)).toEqual({ ok: true });
  });

  it('extracts the JSON object when wrapped in prose', () => {
    const text = 'Here are your recipes: {"recipes":[1,2]} — enjoy!';
    expect(parseJsonLoose(text)).toEqual({ recipes: [1, 2] });
  });

  it('throws a ClaudeError of kind "parse" on unparseable input', () => {
    expect(() => parseJsonLoose('not json at all')).toThrow(ClaudeError);
    try {
      parseJsonLoose('not json at all');
    } catch (e) {
      expect((e as ClaudeError).kind).toBe('parse');
    }
  });
});

describe('isValidAIResponse', () => {
  it('accepts a well-formed response', () => {
    const res: AIResponse = { recipes: [validRecipe] };
    expect(isValidAIResponse(res)).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isValidAIResponse(null)).toBe(false);
    expect(isValidAIResponse('a string')).toBe(false);
    expect(isValidAIResponse(42)).toBe(false);
  });

  it('rejects a response with no recipes', () => {
    expect(isValidAIResponse({ recipes: [] })).toBe(false);
    expect(isValidAIResponse({})).toBe(false);
  });

  it('rejects a recipe with an empty steps list', () => {
    const bad = { recipes: [{ ...validRecipe, steps: [] }] };
    expect(isValidAIResponse(bad)).toBe(false);
  });

  it('rejects a recipe where cookTime is not a number', () => {
    const bad = { recipes: [{ ...validRecipe, cookTime: '25 min' }] };
    expect(isValidAIResponse(bad)).toBe(false);
  });

  it('rejects a recipe missing its ingredients array', () => {
    const { ingredients, ...noIngredients } = validRecipe;
    void ingredients;
    const bad = { recipes: [noIngredients] };
    expect(isValidAIResponse(bad)).toBe(false);
  });
});
