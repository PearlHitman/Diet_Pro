// Single-recipe detail view.

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { Star } from '../components/Icons';
import { useApp } from '../lib/app-state';

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { recipes, toggleStar, t } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);

  if (!recipe) {
    return (
      <Screen>
        <SubHeader title={t('recipe')} onBack={() => navigate(-1)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader
        title={t('recipe')}
        right={
          <button
            aria-label="Favorite"
            onClick={() => toggleStar(recipe.id)}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><Star filled={recipe.starred} size={18} /></button>
        }
      />
      <div style={{ padding: '14px 16px 0' }}>
        <RecipeCard recipe={recipe} expanded linkToDetail={false} showSteps={false} />
      </div>
      <div style={{ padding: '0 16px 28px' }}>
        <button
          className="press"
          onClick={() => navigate(`/recipe/${recipe.id}/cook`)}
          style={{
            width: '100%', height: 52, borderRadius: 'var(--mise-radius-button)',
            border: 'none', background: 'var(--mise-primary)',
            color: '#FFFFFF', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--mise-font-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
            🍳
          </span>
          <span>{t('startCooking')}</span>
        </button>
      </div>
    </Screen>
  );
}
