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
      <div style={{ padding: '14px 16px 28px' }}>
        <RecipeCard recipe={recipe} expanded linkToDetail={false} />
      </div>
    </Screen>
  );
}
