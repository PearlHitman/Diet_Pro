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
import { T } from '../tokens';

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
  const [maxTime, setMaxTime] = useState(30);
  const [dietary, setDietary] = useState<string[]>([]);
  const activeCount = customization.mustInclude.length + customization.skip.length;

  const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Low-carb', 'High-protein'] as const;

  function toggleDiet(d: string) {
    setDietary(arr => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d]);
  }

  function pick(meal: MealType) {
    // Always start with a clean flow slate so an aborted previous attempt
    // doesn't leak into this one.
    clearFlowState();
    const dietaryPayload = dietary.length > 0 ? dietary : undefined;
    const maxTimePayload = maxTime !== 120 ? maxTime : undefined; // 120 = "no limit"
    if (dishMode) {
      const trimmed = dishIdea.trim();
      if (!trimmed) {
        setDishErr(true);
        return;
      }
      setDishErr(false);
      const flow = { mealType: meal, customization, dishIdea: trimmed, maxTime: maxTimePayload, dietary: dietaryPayload };
      saveFlowState(flow);
      navigate('/generate/loading', { state: flow });
      return;
    }
    const flow = { mealType: meal, customization, maxTime: maxTimePayload, dietary: dietaryPayload };
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
              fontSize: T.fontSize.small,
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
                fontSize: T.fontSize.small,
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
                fontSize: T.fontSize.bodyLg,
                fontFamily: 'var(--mise-font-text)',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: 'var(--mise-shadow-sm)',
              }}
            />
            <div
              style={{
                fontSize: T.fontSize.caption,
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
            fontSize: T.fontSize.heading,
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
            fontSize: T.fontSize.body,
            color: 'var(--mise-text-secondary)',
            marginTop: 8,
            marginBottom: 22,
          }}
        >
          {subtitle}
        </div>

        {/* ── Max time slider ─────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            fontFamily: 'var(--font-sans)', marginBottom: 10,
          }}>
            {t('maxTimeLabel')}
          </div>
          <div style={{
            padding: '16px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 10,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 28,
                fontWeight: 400, color: 'var(--text)',
              }}>
                {maxTime === 120 ? '∞' : maxTime}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                {t('minutesSuffix')}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={maxTime}
              onChange={e => setMaxTime(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 4,
              fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-sans)',
            }}>
              <span>10m</span>
              <span>∞ any time</span>
            </div>
          </div>
        </div>

        {/* ── Dietary chips ───────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            fontFamily: 'var(--font-sans)', marginBottom: 10,
          }}>
            {t('dietaryLabel')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DIETARY_OPTIONS.map(d => {
              const isActive = dietary.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiet(d)}
                  className="press"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '6px 12px', borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-strong)'}`,
                    background: isActive ? 'var(--primary-dim)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
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
                    fontSize: T.fontSize.section,
                  lineHeight: 1,
                }}
              >
                {m.emoji}
              </div>
              <div>
                <div
                  style={{
                      fontSize: T.fontSize.bodyLg,
                    fontWeight: 600,
                    color: 'var(--mise-text-primary)',
                    letterSpacing: -0.2,
                  }}
                >
                  {t(m.titleKey)}
                </div>
                <div
                  style={{
                      fontSize: T.fontSize.small,
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
