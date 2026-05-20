// Recipe card — full or compact view. Reused in Results and Detail.

import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../tokens';
import { Clock, Flame, TrendingUp, AlertCircle, Star } from './Icons';
import { SectionLabel } from './Chrome';
import { useApp } from '../lib/app-state';
import type { Recipe } from '../lib/types';

const metaRowWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  fontSize: 12.5, color: T.text2, fontWeight: 500,
};
const metaRowIconSpan: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const metaRowDot: React.CSSProperties = { color: T.mute2 };
const metaServingLine: React.CSSProperties = {
  marginTop: 6, fontSize: 12, color: T.muted, fontWeight: 600,
};

const recipeCardShell: React.CSSProperties = {
  background: 'var(--mise-glass-fill)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid var(--mise-glass-border)',
  borderRadius: 'var(--mise-radius-card)',
  boxShadow: 'var(--mise-shadow-glass)',
  padding: '20px 20px 18px',
  display: 'flex', flexDirection: 'column', gap: 16,
};
const recipeHeaderRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
};
const recipeTitleCol: React.CSSProperties = { flex: 1, minWidth: 0 };
const recipeNameStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.4,
  lineHeight: 1.25,
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
  fontSize: 12, color: T.text2,
};
const missingBannerStrong: React.CSSProperties = { color: T.warning, fontWeight: 600 };
const ingredientsGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px',
};
const ingredientRowMissing: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13,
  color: T.muted,
};
const ingredientRowOk: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13,
  color: T.text,
};
const ingredientAmtStyle: React.CSSProperties = {
  fontSize: 11, color: T.mute2, fontVariantNumeric: 'tabular-nums', minWidth: 38,
};
const ingredientNameMissing: React.CSSProperties = { flex: 1, textDecoration: 'underline dotted' };
const ingredientNameOk: React.CSSProperties = { flex: 1, textDecoration: 'none' };
const stepsOl: React.CSSProperties = {
  margin: 0, padding: 0, listStyle: 'none',
  display: 'flex', flexDirection: 'column', gap: 12,
};
const stepLi: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  fontSize: 13.5, color: T.text2, lineHeight: 1.55,
};
const stepNumBadge: React.CSSProperties = {
  flex: 'none',
  width: 22, height: 22, borderRadius: 999,
  background: T.accentTint, color: T.accent,
  border: `1px solid ${T.borderAcc}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  marginTop: 1,
};
const stepBody: React.CSSProperties = { flex: 1 };
const chefTipsUl: React.CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const chefTipLi: React.CSSProperties = { fontSize: 13.5, color: T.text2, lineHeight: 1.5 };
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
          <div>
            <SectionLabel>{t('ingredientsLabel')}</SectionLabel>
            <div style={ingredientsGrid}>
              {recipe.ingredients.map((it, i) => (
                <div key={i} style={it.missing ? ingredientRowMissing : ingredientRowOk}>
                  <span style={ingredientAmtStyle}>{it.amount}</span>
                  <span style={it.missing ? ingredientNameMissing : ingredientNameOk}>
                    {it.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {showSteps && (
            <div>
              <SectionLabel>{t('stepsLabel')}</SectionLabel>
              <ol style={stepsOl}>
                {recipe.steps.map((step, i) => (
                  <li key={i} style={stepLi}>
                    <div style={stepNumBadge}>{i + 1}</div>
                    <div style={stepBody}>{step}</div>
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
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
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
