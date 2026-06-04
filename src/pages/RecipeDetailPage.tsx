// Single-recipe detail view.

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChefHat, ArrowRight } from 'lucide-react';
import { Screen, SubHeader } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { Star } from '../components/Icons';
import { useApp } from '../lib/app-state';
import { acquireWakeLock } from '../lib/wake-lock';

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { recipes, toggleStar, t } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);

  useEffect(() => {
    let release: (() => void) | null = null;
    let cancelled = false;

    async function request() {
      const cleanup = await acquireWakeLock();
      if (cancelled) { cleanup(); return; }
      release?.();
      release = cleanup;
    }

    void request();

    const onVis = () => {
      if (document.hidden) {
        release?.();
        release = null;
        return;
      }
      void request();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      release?.();
      release = null;
    };
  }, []);

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
      <div style={{ padding: '14px 18px 0' }}>
        <RecipeCard recipe={recipe} expanded linkToDetail={false} showSteps />
      </div>
      <div style={{ padding: '20px 18px 32px' }}>
        <button
          type="button"
          className="press"
          onClick={() => navigate(`/recipe/${recipe.id}/cook`)}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 18px',
            borderRadius: 'var(--radius-button)',
            border: 'none',
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 8px 24px var(--primary-glow)',
          }}
        >
          <ChefHat size={18} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <span>{t('startCooking')}</span>
          <ArrowRight size={16} strokeWidth={2.4} style={{ flexShrink: 0, opacity: 0.85 }} />
        </button>
      </div>
    </Screen>
  );
}
