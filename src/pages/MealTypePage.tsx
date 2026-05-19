// Meal type picker — first step of the generation flow.
// Pantry-first: /generate → pick a meal style tile → loading.
// Dish-in-mind: /generate?mode=specific → describe dish → pick style → loading.

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { Sliders } from '../components/Icons';
import { CustomizationSheet } from '../components/CustomizationSheet';
import { useApp } from '../lib/app-state';
import { saveFlowState, clearFlowState } from '../lib/generate-flow';
import { EMPTY_CUSTOMIZATION, type Customization, type MealType } from '../lib/types';

interface Meal {
  id: MealType;
  emoji: string;
  titleKey: 'mealQuick' | 'mealHealthy' | 'mealComfort' | 'mealFestive';
  subKey: 'mealQuickSub' | 'mealHealthySub' | 'mealComfortSub' | 'mealFestiveSub';
}

const MEALS: Meal[] = [
  { id: 'quick', emoji: '⚡', titleKey: 'mealQuick', subKey: 'mealQuickSub' },
  { id: 'healthy', emoji: '🥗', titleKey: 'mealHealthy', subKey: 'mealHealthySub' },
  { id: 'comfort', emoji: '🍲', titleKey: 'mealComfort', subKey: 'mealComfortSub' },
  { id: 'festive', emoji: '🎉', titleKey: 'mealFestive', subKey: 'mealFestiveSub' },
];

export function MealTypePage() {
  const { pantry, t } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dishMode = searchParams.get('mode') === 'specific';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [customization, setCustomization] = useState<Customization>(EMPTY_CUSTOMIZATION);
  const [dishIdea, setDishIdea] = useState('');
  const [dishErr, setDishErr] = useState(false);
  const activeCount = customization.mustInclude.length + customization.skip.length;

  function pick(meal: MealType) {
    // Always start with a clean flow slate so an aborted previous attempt
    // doesn't leak into this one.
    clearFlowState();
    if (dishMode) {
      const trimmed = dishIdea.trim();
      if (!trimmed) {
        setDishErr(true);
        return;
      }
      setDishErr(false);
      const flow = { mealType: meal, customization, dishIdea: trimmed };
      saveFlowState(flow);
      navigate('/generate/loading', { state: flow });
      return;
    }
    const flow = { mealType: meal, customization };
    saveFlowState(flow);
    navigate('/generate/loading', { state: flow });
  }

  const subtitle = dishMode
    ? t('whatStyleForDish')
    : t('usingNIngredients', { n: pantry.length });

  return (
    <Screen>
      <SubHeader
        title={t('generateRecipe')}
        right={
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 'var(--mise-radius-pill)',
              background: activeCount > 0 ? 'rgba(124, 58, 237, 0.14)' : 'var(--mise-glass-fill)',
              border: activeCount > 0 ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid var(--mise-glass-border)',
              color: activeCount > 0 ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--mise-font-text)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <Sliders size={13} />
            {t('customize')}
            {activeCount > 0 && (
              <span
                key="active"
                className="badge-in"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ({activeCount})
              </span>
            )}
          </button>
        }
      />

      <div style={{ padding: '16px 20px 28px' }}>
        {dishMode && (
          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="dish-idea"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.4,
                color: 'var(--mise-text-tertiary)',
                marginBottom: 10,
                fontFamily: 'var(--mise-font-text)',
              }}
            >
              {t('dishIdeaLabel')}
            </label>
            <textarea
              id="dish-idea"
              rows={3}
              value={dishIdea}
              onChange={e => {
                setDishIdea(e.target.value);
                if (dishErr) setDishErr(false);
              }}
              placeholder={t('dishIdeaPlaceholder')}
              style={{
                width: '100%',
                resize: 'none',
                padding: '14px 16px',
                background: 'var(--mise-glass-fill)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: `1px solid ${dishErr ? 'var(--mise-error)' : 'var(--mise-glass-border)'}`,
                borderRadius: 'var(--mise-radius-input)',
                color: 'var(--mise-text-primary)',
                fontSize: 15,
                fontFamily: 'var(--mise-font-text)',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: 'var(--mise-shadow-sm)',
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: dishErr ? 'var(--mise-error)' : 'var(--mise-text-tertiary)',
                marginTop: 8,
                lineHeight: 1.45,
              }}
            >
              {dishErr ? t('dishIdeaRequired') : t('dishIdeaHint')}
            </div>
          </div>
        )}

        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--mise-text-primary)',
            letterSpacing: -0.4,
            fontFamily: 'var(--mise-font-display)',
          }}
        >
          {t('whatKindOfMeal')}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--mise-text-secondary)',
            marginTop: 8,
            marginBottom: 22,
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {MEALS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              className="press"
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--mise-radius-card)',
                background: 'var(--mise-glass-fill)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid var(--mise-glass-border)',
                boxShadow: 'var(--mise-shadow-glass)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 132,
                textAlign: 'left',
                fontFamily: 'var(--mise-font-text)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(124, 58, 237, 0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  lineHeight: 1,
                }}
              >
                {m.emoji}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--mise-text-primary)',
                    letterSpacing: -0.2,
                  }}
                >
                  {t(m.titleKey)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--mise-text-secondary)',
                    marginTop: 4,
                  }}
                >
                  {t(m.subKey)}
                </div>
              </div>
            </button>
          ))}
        </div>

      </div>

      <CustomizationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        pantry={pantry}
        initial={customization}
        onApply={next => setCustomization(next)}
      />
    </Screen>
  );
}
