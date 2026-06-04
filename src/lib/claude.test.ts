// Tests for the functions that guard untrusted AI output.
// `parseJsonLoose` and `isValidAIResponse` decide whether we trust what
// Claude sent back — if they regress, malformed data reaches the UI.

import { describe, it, expect } from 'vitest';
import {
  parseJsonLoose,
  isValidAIResponse,
  isValidAIDishResponse,
  ClaudeError,
} from './claude';
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

  it('tolerates trailing prose after the JSON', () => {
    const text = '{"name":"x"}\n\nLet me know if you want substitutions.';
    expect(parseJsonLoose(text)).toEqual({ name: 'x' });
  });

  it('handles nested objects and arrays', () => {
    const text = '```json\n{"recipes":[{"name":"a","tags":["x","y"]}]}\n```';
    expect(parseJsonLoose(text)).toEqual({
      recipes: [{ name: 'a', tags: ['x', 'y'] }],
    });
  });

  it('throws a ClaudeError of kind "parse" on unparseable input', () => {
    expect(() => parseJsonLoose('not json at all')).toThrow(ClaudeError);
    try {
      parseJsonLoose('not json at all');
    } catch (e) {
      expect((e as ClaudeError).kind).toBe('parse');
    }
  });

  it('throws on empty string', () => {
    expect(() => parseJsonLoose('')).toThrow(ClaudeError);
  });

  it('throws when only fences with no body', () => {
    expect(() => parseJsonLoose('```json\n```')).toThrow(ClaudeError);
  });
});

describe('isValidAIResponse', () => {
  it('accepts a well-formed response', () => {
    const res: AIResponse = { recipes: [validRecipe] };
    expect(isValidAIResponse(res)).toBe(true);
  });

  it('accepts optional chefTips when present and string-typed', () => {
    const res = { recipes: [{ ...validRecipe, chefTips: ['Salt early.'] }] };
    expect(isValidAIResponse(res)).toBe(true);
  });

  it('accepts optional serving when string-typed', () => {
    const res = { recipes: [{ ...validRecipe, serving: 'Serves 4' }] };
    expect(isValidAIResponse(res)).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isValidAIResponse(null)).toBe(false);
    expect(isValidAIResponse('a string')).toBe(false);
    expect(isValidAIResponse(42)).toBe(false);
    expect(isValidAIResponse(undefined)).toBe(false);
  });

  it('rejects a response with no recipes', () => {
    expect(isValidAIResponse({ recipes: [] })).toBe(false);
    expect(isValidAIResponse({})).toBe(false);
  });

  it('respects maxRecipes', () => {
    const res = { recipes: [validRecipe, validRecipe, validRecipe] };
    expect(isValidAIResponse(res, { maxRecipes: 2 })).toBe(false);
    expect(isValidAIResponse(res, { maxRecipes: 3 })).toBe(true);
  });

  it('accepts 2 recipes for fast mode bounds', () => {
    const res = { recipes: [validRecipe, validRecipe] };
    expect(isValidAIResponse(res, { minRecipes: 1, maxRecipes: 2 })).toBe(true);
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

  it('rejects when an ingredient is missing the boolean `missing` flag', () => {
    const bad = {
      recipes: [{
        ...validRecipe,
        ingredients: [{ name: 'oil', amount: '1 tbsp' }],
      }],
    };
    expect(isValidAIResponse(bad)).toBe(false);
  });

  it('rejects when difficulty is unknown', () => {
    const bad = { recipes: [{ ...validRecipe, difficulty: 'Wizard' }] };
    expect(isValidAIResponse(bad)).toBe(false);
  });

  it('rejects when chefTips contains a non-string', () => {
    const bad = {
      recipes: [{ ...validRecipe, chefTips: ['Salt early.', 42] }],
    };
    expect(isValidAIResponse(bad)).toBe(false);
  });

  it('rejects when pantryCategory is not a known category', () => {
    const bad = {
      recipes: [{
        ...validRecipe,
        ingredients: [{
          name: 'oil', amount: '1 tbsp', missing: true, pantryCategory: 'snacks',
        }],
      }],
    };
    expect(isValidAIResponse(bad)).toBe(false);
  });
});

describe('isValidAIDishResponse', () => {
  it('accepts a well-formed single-dish response', () => {
    const res = { recipe: validRecipe };
    expect(isValidAIDishResponse(res)).toBe(true);
  });

  it('rejects when wrapped under "recipes" instead of "recipe"', () => {
    expect(isValidAIDishResponse({ recipes: [validRecipe] })).toBe(false);
  });

  it('rejects null and non-objects', () => {
    expect(isValidAIDishResponse(null)).toBe(false);
    expect(isValidAIDishResponse('')).toBe(false);
  });

  it('rejects when recipe lacks required fields', () => {
    expect(isValidAIDishResponse({ recipe: {} })).toBe(false);
  });
});
