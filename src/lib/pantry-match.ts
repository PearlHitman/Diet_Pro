import type { Ingredient } from './types';

/** Loose case-insensitive match between a recipe ingredient name and pantry items. */
export function pantryMatchesName(pantry: Ingredient[], recipeIngName: string): boolean {
  const n = recipeIngName.toLowerCase().trim();
  if (!n) return false;
  return pantry.some(p => {
    const pn = p.name.toLowerCase().trim();
    if (!pn) return false;
    return pn.includes(n) || n.includes(pn);
  });
}
