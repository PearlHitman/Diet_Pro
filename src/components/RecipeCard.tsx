// Recipe card — full or compact view. Reused in Results and Detail.

import React from 'react';
import { Link } from 'react-router-dom';
import { T } from '../tokens';
import { Clock, Flame, TrendingUp, AlertCircle, Star } from './Icons';
import { SectionLabel } from './Chrome';
import { useApp } from '../lib/app-state';
import type { Recipe } from '../lib/types';

export function MetaRow({ recipe }: { recipe: Recipe }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      fontSize: 12.5, color: T.text2, fontWeight: 500,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Clock size={13} color={T.muted} />{recipe.cookTime} min
      </span>
      <span style={{ color: T.mute2 }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <TrendingUp size={13} color={T.muted} />{recipe.difficulty}
      </span>
      <span style={{ color: T.mute2 }}>·</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Flame size={13} color={T.muted} />~{recipe.calories} kcal
      </span>
    </div>
  );
}

export function RecipeCard({
  recipe, expanded = false, linkToDetail = true,
}: { recipe: Recipe; expanded?: boolean; linkToDetail?: boolean }) {
  const { toggleStar, t } = useApp();
  const missing = recipe.ingredients.filter(i => i.missing).length;

  const inner = (
    <div style={{
      background: 'var(--mise-glass-fill)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid var(--mise-glass-border)',
      borderRadius: 'var(--mise-radius-card)',
      boxShadow: 'var(--mise-shadow-glass)',
      padding: '20px 20px 18px',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.4,
            lineHeight: 1.25,
          }}>{recipe.name}</div>
          <div style={{ marginTop: 8 }}><MetaRow recipe={recipe} /></div>
        </div>
        <button
          aria-label="Favorite"
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleStar(recipe.id); }}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: -2,
          }}
        ><Star filled={recipe.starred} size={18} /></button>
      </div>

      {/* Missing-ingredient banner */}
      {missing > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.warnTint, border: `1px solid ${T.warnBord}`,
          borderRadius: 10, padding: '8px 12px',
          fontSize: 12, color: T.text2,
        }}>
          <AlertCircle size={13} color={T.warning} />
          <span>
            <strong style={{ color: T.warning, fontWeight: 600 }}>{missing} {t('missing')}</strong>
            {' — '}{t('missingHint')}
          </span>
        </div>
      )}

      {expanded && (
        <>
          {/* Ingredients */}
          <div>
            <SectionLabel>{t('ingredientsLabel')}</SectionLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px',
            }}>
              {recipe.ingredients.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13,
                  color: it.missing ? T.muted : T.text,
                }}>
                  <span style={{
                    fontSize: 11, color: T.mute2, fontVariantNumeric: 'tabular-nums', minWidth: 38,
                  }}>{it.amount}</span>
                  <span style={{ flex: 1, textDecoration: it.missing ? 'underline dotted' : 'none' }}>
                    {it.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <SectionLabel>{t('stepsLabel')}</SectionLabel>
            <ol style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {recipe.steps.map((step, i) => (
                <li key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  fontSize: 13.5, color: T.text2, lineHeight: 1.55,
                }}>
                  <div style={{
                    flex: 'none',
                    width: 22, height: 22, borderRadius: 999,
                    background: T.accentTint, color: T.accent,
                    border: `1px solid ${T.borderAcc}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 1,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>{step}</div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );

  if (linkToDetail && !expanded) {
    return (
      <Link to={`/recipe/${recipe.id}`} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
