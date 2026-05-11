// Meal type picker — first step of the generation flow.
// User taps a tile → navigate to /generate/loading with the mealType
// passed via location.state.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import type { MealType } from '../lib/types';

interface Meal {
  id: MealType;
  emoji: string;
  titleKey: 'mealQuick' | 'mealHealthy' | 'mealComfort' | 'mealFestive';
  subKey:   'mealQuickSub' | 'mealHealthySub' | 'mealComfortSub' | 'mealFestiveSub';
}

const MEALS: Meal[] = [
  { id: 'quick',   emoji: '⚡', titleKey: 'mealQuick',   subKey: 'mealQuickSub' },
  { id: 'healthy', emoji: '🥗', titleKey: 'mealHealthy', subKey: 'mealHealthySub' },
  { id: 'comfort', emoji: '🍲', titleKey: 'mealComfort', subKey: 'mealComfortSub' },
  { id: 'festive', emoji: '🎉', titleKey: 'mealFestive', subKey: 'mealFestiveSub' },
];

export function MealTypePage() {
  const { pantry, t } = useApp();
  const navigate = useNavigate();

  function pick(meal: MealType) {
    navigate('/generate/loading', { state: { mealType: meal } });
  }

  return (
    <Screen>
      <SubHeader title={t('generateRecipe')} />

      <div style={{ padding: '20px 20px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>
          {t('whatKindOfMeal')}
        </div>
        <div style={{ fontSize: 13, color: T.text2, marginTop: 6, marginBottom: 22 }}>
          {t('usingNIngredients', { n: pantry.length })}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {MEALS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              style={{
                padding: '18px 14px 16px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${T.border}`,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
                minHeight: 124, textAlign: 'left',
                fontFamily: T.font,
              }}
            >
              <div style={{ fontSize: 28, lineHeight: 1 }}>{m.emoji}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: -0.2 }}>
                  {t(m.titleKey)}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                  {t(m.subKey)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
