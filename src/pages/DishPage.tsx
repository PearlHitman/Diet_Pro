// Goal-first flow: dish name → full recipe → shopping list grouped by aisle.

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, SubHeader, SectionLabel } from '../components/Chrome';
import { Sparkles } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { ClaudeError, generateDishRecipe, suggestSubstitutions } from '../lib/claude';
import { pantryMatchesName } from '../lib/pantry-match';
import { t as translate } from '../lib/i18n';
import type { Category, Recipe, RecipeIngredient, Ingredient } from '../lib/types';

const CATEGORY_ORDER: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

type TKey = Parameters<typeof translate>[1];

export function DishPage() {
  const navigate = useNavigate();
  const { pantry, profile, settings, appendRecipes, t } = useApp();

  const [dishQuery, setDishQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [busySubs, setBusySubs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [subs, setSubs] = useState<string | null>(null);

  const [shopTick, setShopTick] = useState<Record<string, boolean>>({});

  const missingList = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.filter(i => !pantryMatchesName(pantry, i.name));
  }, [recipe, pantry]);

  const groupedShop = useMemo(() => {
    const out: Record<Category, RecipeIngredient[]> = {
      produce: [], protein: [], dairy: [], grains: [], pantry: [], other: [],
    };
    for (const it of missingList) {
      const cat: Category = it.pantryCategory && CATEGORY_ORDER.includes(it.pantryCategory)
        ? it.pantryCategory
        : 'other';
      out[cat].push(it);
    }
    return out;
  }, [missingList]);

  const toggleShop = useCallback((name: string) => {
    setShopTick(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  async function generate() {
    const q = dishQuery.trim();
    if (!q || busy) return;
    setBusy(true);
    setErr(null);
    setSubs(null);
    try {
      const r = await generateDishRecipe({ dishName: q, pantry, profile, settings });
      setRecipe(r);
      setShopTick({});
    } catch (e) {
      if (e instanceof ClaudeError) {
        const map: Record<ClaudeError['kind'], string> = {
          auth: t('errorNoKey'),
          rate: t('errorRate'),
          network: t('errorNetwork'),
          parse: t('errorParse'),
          unknown: t('errorTitle'),
        };
        setErr(map[e.kind]);
      } else {
        setErr(t('errorTitle'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubstitutions() {
    const names = missingList.map(i => i.name.trim()).filter(Boolean);
    if (!names.length || busySubs) return;
    setBusySubs(true);
    setErr(null);
    try {
      const text = await suggestSubstitutions({
        missingIngredientNames: names,
        pantry,
        settings,
      });
      setSubs(text);
    } catch (e) {
      if (e instanceof ClaudeError) setErr(e.message);
      else setErr(t('errorParse'));
    } finally {
      setBusySubs(false);
    }
  }

  async function saveHistory() {
    if (!recipe) return;
    await appendRecipes([recipe]);
    navigate(`/recipe/${recipe.id}`, { replace: true });
  }

  async function addFavorites() {
    if (!recipe) return;
    await appendRecipes([{ ...recipe, starred: true }]);
    navigate(`/recipe/${recipe.id}`, { replace: true });
  }

  function backToInput() {
    setRecipe(null);
    setSubs(null);
    setErr(null);
  }

  const catLabels: Record<Category, string> = {
    produce: t('cat_produce'),
    protein: t('cat_protein'),
    dairy: t('cat_dairy'),
    grains: t('cat_grains'),
    pantry: t('cat_pantry'),
    other: t('cat_other'),
  };

  if (!recipe) {
    return (
      <Screen>
        <SubHeader title={t('dishIdeaLabel')} onBack={() => navigate('/')} />

        <div style={{ padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {err && (
            <div style={{ fontSize: T.fontSize.body, color: 'var(--mise-error)', lineHeight: 1.45 }}>{err}</div>
          )}

          <input
            type="text"
            value={dishQuery}
            onChange={e => setDishQuery(e.target.value)}
            placeholder={t('dishIdeaPlaceholder')}
            disabled={busy}
            autoFocus
            style={{
              width: '100%',
              padding: '16px 18px',
              background: 'var(--mise-glass-fill)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid var(--mise-glass-border)',
              borderRadius: 'var(--mise-radius-input)',
              color: 'var(--mise-text-primary)',
              fontSize: T.fontSize.base,
              fontFamily: 'var(--mise-font-text)',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="button"
            className="press-soft"
            disabled={busy || !dishQuery.trim()}
            onClick={() => generate()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 'var(--mise-radius-button)',
              border: 'none',
              background: dishQuery.trim() && !busy ? 'var(--mise-primary)' : 'var(--mise-text-tertiary)',
              color: '#FFFFFF',
              fontSize: T.fontSize.base,
              fontWeight: 600,
              cursor: dishQuery.trim() && !busy ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--mise-font-text)',
              boxShadow: dishQuery.trim() && !busy ? '0px 4px 12px rgba(124, 58, 237, 0.3)' : undefined,
            }}
          >
            {busy ? t('loading') : t('dishGenerate')}
          </button>

          {busy && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
              <div
                className="pulse"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: T.accentTint,
                  border: `1px solid ${T.borderAcc}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={26} color={T.accent} />
              </div>
              <div style={{ fontSize: T.fontSize.body, color: 'var(--mise-text-secondary)' }}>{t('generating')}</div>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader title={t('recipe')} onBack={() => backToInput()} />

      <div style={{ padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {err && <div style={{ fontSize: T.fontSize.body, color: 'var(--mise-error)', lineHeight: 1.45 }}>{err}</div>}

        <DishRecipeWithDots recipe={recipe} pantry={pantry} t={t} />

        {/* Shopping list */}
        <div style={{ marginTop: 8 }}>
          <SectionLabel>{t('dishShoppingList')}</SectionLabel>
          {missingList.length === 0 ? (
            <div style={{ fontSize: T.fontSize.body, color: 'var(--mise-text-secondary)', marginTop: 8 }}>
              {t('dishShoppingAllSet')}
            </div>
          ) : (
            CATEGORY_ORDER.map(cat =>
              groupedShop[cat].length === 0 ? null : (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: T.fontSize.caption,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'var(--mise-text-tertiary)',
                      marginBottom: 10,
                    }}
                  >
                    {catLabels[cat]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupedShop[cat].map(it => (
                      <label
                        key={it.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          background: 'var(--mise-glass-fill)',
                          border: '1px solid var(--mise-glass-border)',
                          borderRadius: 'var(--mise-radius-button)',
                          fontSize: T.fontSize.bodyLg,
                          color: 'var(--mise-text-primary)',
                          fontFamily: 'var(--mise-font-text)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={shopTick[it.name] ?? false}
                          onChange={() => toggleShop(it.name)}
                          style={{ width: 20, height: 20 }}
                        />
                        <span style={{ flex: 1 }}>
                          <span style={{ fontSize: T.fontSize.caption, color: 'var(--mise-text-tertiary)', marginRight: 8 }}>
                            {it.amount}
                          </span>
                          {it.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ),
            )
          )}

          {missingList.length > 0 && (
            <button
              type="button"
              className="press"
              disabled={busySubs}
              onClick={() => onSubstitutions()}
              style={{
                marginTop: 14,
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--mise-radius-button)',
                border: '1px solid var(--mise-glass-border)',
                background: 'var(--mise-glass-fill)',
                color: 'var(--mise-primary)',
                fontSize: T.fontSize.bodyLg,
                fontWeight: 600,
                cursor: busySubs ? 'wait' : 'pointer',
                fontFamily: 'var(--mise-font-text)',
              }}
            >
              {busySubs ? t('substitutionsLoading') : t('dishCanSubstitute')}
            </button>
          )}

          {subs && (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>{t('dishSubstitutionTitle')}</SectionLabel>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: T.fontSize.body,
                  lineHeight: 1.55,
                  color: 'var(--mise-text-secondary)',
                  margin: '10px 0 0',
                  fontFamily: 'var(--mise-font-text)',
                }}
              >
                {subs}
              </pre>
            </div>
          )}
        </div>

        {/* Save actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="press-soft"
            onClick={() => saveHistory()}
            style={{
              padding: '14px',
              borderRadius: 'var(--mise-radius-button)',
              border: 'none',
              background: 'var(--mise-primary)',
              color: '#FFFFFF',
              fontSize: T.fontSize.bodyLg,
              fontWeight: 600,
              fontFamily: 'var(--mise-font-text)',
              boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
            }}
          >
            {t('dishSaveHistory')}
          </button>
          <button
            type="button"
            className="press"
            onClick={() => addFavorites()}
            style={{
              padding: '14px',
              borderRadius: 'var(--mise-radius-button)',
              border: '1px solid var(--mise-glass-border)',
              background: 'var(--mise-glass-fill)',
              color: 'var(--mise-text-primary)',
              fontSize: T.fontSize.bodyLg,
              fontWeight: 600,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('dishAddFavorites')}
          </button>
        </div>
      </div>
    </Screen>
  );
}

function DishRecipeWithDots({
  recipe,
  pantry,
  t,
}: {
  recipe: Recipe;
  pantry: Ingredient[];
  t: (k: TKey, v?: Record<string, string | number>) => string;
}) {
  const ingBlock = (
    <div style={{ marginTop: 14 }}>
      <SectionLabel>{t('ingredientsLabel')}</SectionLabel>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipe.ingredients.map((ing, idx) => {
          const inPantry = pantryMatchesName(pantry, ing.name);
          return (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: T.fontSize.small, color: T.text }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: inPantry ? 'var(--mise-success)' : 'var(--mise-text-tertiary)',
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <span style={{ fontSize: T.fontSize.tiny, color: T.mute2, minWidth: 40 }}>{ing.amount}</span>
              <span style={{ flex: 1 }}>{ing.name}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: T.fontSize.caption, color: 'var(--mise-text-tertiary)' }}>
        {t('recipeDotLegend')}
      </div>
    </div>
  );

  const stepsBlock = (
    <div style={{ marginTop: 18 }}>
      <SectionLabel>{t('stepsLabel')}</SectionLabel>
      <ol style={{
        margin: '10px 0 0',
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {recipe.steps.map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: T.fontSize.bodySm, color: T.text2 }}>
            <div style={{
              flex: 'none',
              width: 22,
              height: 22,
              borderRadius: 999,
              background: T.accentTint,
              color: T.accent,
              border: `1px solid ${T.borderAcc}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: T.fontSize.tiny,
              fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>{step}</div>
          </li>
        ))}
      </ol>
    </div>
  );

  const tipsBlock =
    recipe.chefTips && recipe.chefTips.length > 0 ? (
      <div style={{ marginTop: 18 }}>
        <SectionLabel>{t('chefTipsLabel')}</SectionLabel>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: T.fontSize.bodySm, color: T.text2, lineHeight: 1.5 }}>
          {recipe.chefTips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: T.fontSize.h2,
          fontWeight: 700,
          color: T.text,
          letterSpacing: -0.3,
          fontFamily: 'var(--mise-font-display)',
        }}>
          {recipe.name}
        </div>
        <div style={{ marginTop: 6, fontSize: T.fontSize.body, color: T.text2 }}>{recipe.serving}</div>
      </div>
      {ingBlock}
      {stepsBlock}
      {tipsBlock}
    </div>
  );
}
