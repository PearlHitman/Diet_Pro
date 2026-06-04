// Recipe card — full or compact view. Reused in Results and Detail.

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { T } from '../tokens';
import { Clock, Flame, TrendingUp, AlertCircle, Star } from './Icons';
import { SectionLabel } from './Chrome';
import { useApp } from '../lib/app-state';
import { prefersReducedMotion } from '../lib/motion';
import type { Recipe } from '../lib/types';

const metaRowWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  fontSize: T.fontSize.captionLg, color: T.text2, fontWeight: 500,
};
const metaRowIconSpan: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const metaRowDot: React.CSSProperties = { color: T.mute2 };
const metaServingLine: React.CSSProperties = {
  marginTop: 6, fontSize: T.fontSize.caption, color: T.muted, fontWeight: 600,
};

const recipeCardShell: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)',
  padding: '22px 22px 20px',
  display: 'flex', flexDirection: 'column', gap: 20,
};
const recipeHeaderRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
};
const recipeTitleCol: React.CSSProperties = { flex: 1, minWidth: 0 };
const recipeNameStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 400,
  color: 'var(--text)',
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
  fontFamily: 'var(--font-display)',
};
const recipeMetaRowWrap: React.CSSProperties = { marginTop: 8 };
const starBtnStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 8,
  border: 'none', background: 'transparent', cursor: 'pointer',
  padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  marginTop: -2,
  boxSizing: 'border-box',
};
const missingBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: T.warnTint, border: `1px solid ${T.warnBord}`,
  borderRadius: 10, padding: '8px 12px',
  fontSize: T.fontSize.caption, color: T.text2,
};
const missingBannerStrong: React.CSSProperties = { color: T.warning, fontWeight: 600 };
const ingredientsGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px',
};
const ingredientRowMissing: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, fontSize: T.fontSize.small,
  color: T.muted,
};
const ingredientRowOk: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, fontSize: T.fontSize.small,
  color: T.text,
};
const ingredientInteractiveBtn: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'var(--mise-font-text)',
};
const ingredientCheckbox: React.CSSProperties = {
  flex: 'none',
  width: 18,
  height: 18,
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 1,
  transition: 'background 160ms var(--ease-mise), border-color 160ms var(--ease-mise)',
};
const ingredientCheckboxChecked: React.CSSProperties = {
  border: '1px solid var(--primary)',
  background: 'var(--primary)',
  color: 'var(--on-primary)',
};
const ingredientAmtStyle: React.CSSProperties = {
  fontSize: T.fontSize.tiny, color: T.mute2, fontVariantNumeric: 'tabular-nums', minWidth: 38,
};
const ingredientNameMissing: React.CSSProperties = { flex: 1, textDecoration: 'underline dotted' };
const ingredientNameOk: React.CSSProperties = { flex: 1, textDecoration: 'none' };
const stepsOl: React.CSSProperties = {
  margin: 0, padding: 0, listStyle: 'none',
  display: 'flex', flexDirection: 'column', gap: 12,
};
const stepBtn: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  gap: 14,
  alignItems: 'flex-start',
  fontFamily: 'var(--mise-font-text)',
};
const stepNumCircle: React.CSSProperties = {
  flex: 'none',
  width: 38,
  height: 38,
  borderRadius: 999,
  background: 'var(--primary-dim)',
  color: 'var(--primary)',
  border: '1px solid var(--border-strong)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--font-mono)',
  marginTop: 3,
};
const stepNumCircleDone: React.CSSProperties = {
  background: 'var(--surface-3)',
  color: 'var(--text-3)',
  border: '1px solid var(--border)',
};
const stepBody: React.CSSProperties = { flex: 1 };
const stepText: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--text)',
  lineHeight: 1.55,
  paddingTop: 6,
  fontFamily: 'var(--font-sans)',
};
const jumpIngredientsBtn: React.CSSProperties = {
  position: 'fixed',
  bottom: 96,
  right: 18,
  zIndex: 30,
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: '10px 16px 10px 14px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  boxShadow: 'var(--shadow-lg)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};
const jumpIngredientsDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: 'var(--primary)',
  boxShadow: '0 0 8px var(--primary-glow)',
  flexShrink: 0,
};
const chefTipsUl: React.CSSProperties = {
  margin: '4px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};
const chefTipLi: React.CSSProperties = {
  fontSize: 13.5,
  color: 'var(--text-2)',
  lineHeight: 1.55,
  paddingLeft: 14,
  position: 'relative',
  fontFamily: 'var(--font-sans)',
};
const compactCardLink: React.CSSProperties = { textDecoration: 'none' };

export function MetaRow({ recipe }: { recipe: Recipe }) {
  return (
    <div>
      <div style={metaRowWrap}>
        <span style={metaRowIconSpan}>
          <Clock size={13} color={T.muted} />{recipe.cookTime} min
        </span>
        <span style={metaRowDot}>·</span>
        <span style={metaRowIconSpan}>
          <TrendingUp size={13} color={T.muted} />{recipe.difficulty}
        </span>
        <span style={metaRowDot}>·</span>
        <span style={metaRowIconSpan}>
          <Flame size={13} color={T.muted} />~{recipe.calories} kcal
        </span>
      </div>
      {recipe.serving ? (
        <div style={metaServingLine}>
          {recipe.serving}
        </div>
      ) : null}
    </div>
  );
}

export function RecipeCard({
  recipe, expanded = false, linkToDetail = true, showSteps = true,
}: { recipe: Recipe; expanded?: boolean; linkToDetail?: boolean; showSteps?: boolean }) {
  const { toggleStar, t } = useApp();
  const missing = recipe.ingredients.filter(i => i.missing).length;
  const reduceMotion = prefersReducedMotion();

  // "Cooking session" state — resets when the card remounts or recipe changes.
  // Only enabled in the interactive (detail) view.
  const interactive = expanded && showSteps;
  const [gotIngredient, setGotIngredient] = useState<Record<number, boolean>>({});
  const [doneStep, setDoneStep] = useState<Record<number, boolean>>({});
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const pendingScrollToStep = useRef<number | null>(null);
  const ingredientsRef = useRef<HTMLDivElement | null>(null);
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const [ingredientsInView, setIngredientsInView] = useState(true);
  const [stepsInView, setStepsInView] = useState(false);

  useEffect(() => {
    if (!interactive) return;
    setGotIngredient({});
    setDoneStep({});
  }, [recipe.id, interactive]);

  const showJumpToIngredients = interactive && !ingredientsInView && stepsInView;

  useEffect(() => {
    if (!interactive) return;
    const ingEl = ingredientsRef.current;
    const stepsEl = stepsRef.current;
    if (!ingEl || !stepsEl) return;

    const ingObs = new IntersectionObserver(
      ([entry]) => setIngredientsInView(entry.isIntersecting),
      { threshold: 0.12 },
    );
    const stepsObs = new IntersectionObserver(
      ([entry]) => setStepsInView(entry.isIntersecting),
      { threshold: 0.12 },
    );
    ingObs.observe(ingEl);
    stepsObs.observe(stepsEl);
    return () => {
      ingObs.disconnect();
      stepsObs.disconnect();
    };
  }, [interactive]);

  useEffect(() => {
    if (!interactive) return;
    const idx = pendingScrollToStep.current;
    if (idx == null) return;
    pendingScrollToStep.current = null;
    const el = stepRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }, [doneStep, interactive, reduceMotion]);

  const onToggleIngredient = (idx: number) => {
    setGotIngredient(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const onToggleStep = (idx: number) => {
    setDoneStep(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      let nextUndone: number | null = null;
      for (let i = idx + 1; i < recipe.steps.length; i += 1) {
        if (!next[i]) { nextUndone = i; break; }
      }
      if (nextUndone != null) pendingScrollToStep.current = nextUndone;
      return next;
    });
  };

  const scrollToIngredients = () => {
    const el = ingredientsRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const inner = (
    <div style={recipeCardShell}>
      {/* Header */}
      <div style={recipeHeaderRow}>
        <div style={recipeTitleCol}>
          <div style={recipeNameStyle}>{recipe.name}</div>
          <div style={recipeMetaRowWrap}><MetaRow recipe={recipe} /></div>
        </div>
        <button
          type="button"
          aria-label={recipe.starred ? t('unstarRecipe') : t('starRecipe')}
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleStar(recipe.id); }}
          style={starBtnStyle}
        ><Star filled={recipe.starred} size={18} /></button>
      </div>

      {/* Missing-ingredient banner */}
      {missing > 0 && (
        <div style={missingBanner}>
          <AlertCircle size={13} color={T.warning} />
          <span>
            <strong style={missingBannerStrong}>{missing} {t('missing')}</strong>
            {' — '}{t('missingHint')}
          </span>
        </div>
      )}

      {expanded && (
        <>
          {/* Ingredients */}
          <div ref={ingredientsRef}>
            <SectionLabel>{t('ingredientsLabel')}</SectionLabel>
            <div style={ingredientsGrid}>
              {recipe.ingredients.map((it, i) => (
                interactive ? (
                  <button
                    key={i}
                    type="button"
                    className="press"
                    role="checkbox"
                    aria-checked={!!gotIngredient[i]}
                    onClick={() => onToggleIngredient(i)}
                    style={{
                      ...ingredientInteractiveBtn,
                      ...(it.missing ? { color: T.muted } : { color: T.text }),
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        ...ingredientCheckbox,
                        ...(gotIngredient[i] ? ingredientCheckboxChecked : {}),
                      }}
                    >
                      {gotIngredient[i] ? <Check size={13} /> : null}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ ...ingredientAmtStyle, ...(gotIngredient[i] ? { opacity: 0.6 } : {}) }}>
                        {it.amount}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          opacity: gotIngredient[i] ? 0.6 : 1,
                          textDecorationLine: it.missing
                            ? (gotIngredient[i] ? 'line-through underline' : 'underline')
                            : (gotIngredient[i] ? 'line-through' : 'none'),
                          textDecorationStyle: it.missing ? 'dotted' : undefined,
                        }}
                      >
                        {it.name}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div key={i} style={it.missing ? ingredientRowMissing : ingredientRowOk}>
                    <span style={ingredientAmtStyle}>{it.amount}</span>
                    <span style={it.missing ? ingredientNameMissing : ingredientNameOk}>
                      {it.name}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>

          {showSteps && (
            <div ref={stepsRef}>
              <SectionLabel>{t('stepsLabel')}</SectionLabel>
              <ol style={stepsOl}>
                {recipe.steps.map((step, i) => (
                  <li
                    key={i}
                    ref={el => { stepRefs.current[i] = el; }}
                    style={{ listStyle: 'none' }}
                  >
                    <button
                      type="button"
                      className="press"
                      role="checkbox"
                      aria-checked={!!doneStep[i]}
                      onClick={() => onToggleStep(i)}
                      style={stepBtn}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          ...stepNumCircle,
                          ...(doneStep[i] ? stepNumCircleDone : {}),
                        }}
                      >
                        {doneStep[i] ? <Check size={18} /> : (i + 1)}
                      </div>
                      <div style={stepBody}>
                        <div
                          style={{
                            ...stepText,
                            ...(doneStep[i] ? { opacity: 0.6, textDecoration: 'line-through' } : {}),
                          }}
                        >
                          {step}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recipe.chefTips.length > 0 && (
            <div>
              <SectionLabel>{t('chefTipsLabel')}</SectionLabel>
              <ul style={chefTipsUl}>
                {recipe.chefTips.map((tip, i) => (
                  <li key={i} style={chefTipLi}>
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '0.6em',
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: 'var(--primary)',
                        opacity: 0.7,
                      }}
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {showJumpToIngredients && (
        <button type="button" className="press" style={jumpIngredientsBtn} onClick={scrollToIngredients}>
          <span aria-hidden="true" style={jumpIngredientsDot} />
          <span>{t('viewIngredients')}</span>
        </button>
      )}
    </div>
  );

  if (linkToDetail && !expanded) {
    return (
      <Link to={`/recipe/${recipe.id}`} style={compactCardLink}>
        {inner}
      </Link>
    );
  }
  return inner;
}
