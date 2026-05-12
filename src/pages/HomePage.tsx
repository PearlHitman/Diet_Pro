// Home page — live feed variant.
// A vertically scrollable card feed: greeting, pantry alerts,
// recipe of the day (TheMealDB), food fact, seasonal spotlight,
// and the generate CTA. All network content is cached daily in IndexedDB.

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Screen, AppHeader } from '../components/Chrome';
import { ArrowRight, AlertCircle } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { getTimeOfDay, TIME_EMOJI, greeting, cuisineFlag } from '../lib/personalization';
import { fetchMealOfDay, refreshMealOfDay, getFoodFact, getSeasonalPicks } from '../lib/feed';
import type { MealOfDay } from '../lib/feed';
import type { Ingredient } from '../lib/types';
import { RecipeOfDayCard, FactCard, SeasonalCard } from '../components/FeedCard';

// ─── Helpers ──────────────────────────────────────────────────────────────

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function expiringSoon(pantry: Ingredient[]): Ingredient[] {
  return pantry
    .filter(it => {
      const d = daysUntil(it.expiresOn);
      return d !== null && d <= 3;
    })
    .sort((a, b) => (daysUntil(a.expiresOn) ?? 999) - (daysUntil(b.expiresOn) ?? 999))
    .slice(0, 4);
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const { pantry, profile, settings, t } = useApp();
  const navigate = useNavigate();

  const expiring = expiringSoon(pantry);
  const needsKey = !settings.apiKey;
  const canGenerate = pantry.length > 0 && !!settings.apiKey;

  const tod = getTimeOfDay();
  const todEmoji = TIME_EMOJI[tod];
  const { line: greetLine, subtitle: greetSub } = greeting(profile.name, profile.language, tod);
  const flag = cuisineFlag(profile.cuisine);
  const expiringToday = expiring.filter(it => {
    const d = daysUntil(it.expiresOn);
    return d !== null && d <= 0;
  }).length;

  // ── Feed state ────────────────────────────────────────────
  const [meal, setMeal] = useState<MealOfDay | null>(null);
  const [mealLoading, setMealLoading] = useState(true);
  const [mealError, setMealError] = useState(false);
  const [mealRefreshing, setMealRefreshing] = useState(false);

  const fact = getFoodFact();
  const { season, picks } = getSeasonalPicks();

  useEffect(() => {
    let cancelled = false;
    setMealLoading(true);
    setMealError(false);
    fetchMealOfDay()
      .then(m => { if (!cancelled) { setMeal(m); setMealLoading(false); } })
      .catch(() => { if (!cancelled) { setMealLoading(false); setMealError(true); } });
    return () => { cancelled = true; };
  }, []);

  function handleRefreshMeal() {
    setMealRefreshing(true);
    setMealError(false);
    refreshMealOfDay()
      .then(m => { setMeal(m); setMealRefreshing(false); })
      .catch(() => { setMealRefreshing(false); setMealError(true); });
  }

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '6px 16px 28px' }}>

        {/* ── 1. Greeting hero ────────────────────────────────── */}
        <div
          className="fade-up"
          style={{ animationDelay: '0ms', marginBottom: 16 }}
        >
          <div style={{
            fontSize: 23, fontWeight: 700, color: T.text,
            letterSpacing: -0.5, lineHeight: 1.2,
          }}>
            {greetLine}{todEmoji ? ` ${todEmoji}` : ''}
          </div>
          <div style={{ fontSize: 13, color: T.text2, marginTop: 5 }}>
            {greetSub}
          </div>

          {(profile.cuisine || pantry.length > 0) && (
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              fontSize: 12, color: T.muted,
            }}>
              {profile.cuisine && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px',
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 999, color: T.text2,
                }}>
                  <span style={{ fontSize: 13 }}>{flag}</span>
                  <span style={{ fontWeight: 500 }}>{profile.cuisine}</span>
                </span>
              )}
              {pantry.length > 0 && (
                <span>{t('youHave')} <strong style={{ color: T.text, fontWeight: 600 }}>{pantry.length}</strong> {t('ingredients')}</span>
              )}
            </div>
          )}
        </div>

        {/* ── 2. API key warning ──────────────────────────────── */}
        {needsKey && (
          <Link
            to="/settings"
            style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}
            className="fade-up"
          >
            <div style={{
              padding: '12px 14px',
              background: T.warnTint, border: `1px solid ${T.warnBord}`,
              borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 10,
              color: T.text2, fontSize: 13,
            }}>
              <AlertCircle size={16} color={T.warning} />
              <span style={{ flex: 1 }}>{t('errorNoKey')}</span>
              <ArrowRight size={14} color={T.warning} />
            </div>
          </Link>
        )}

        {/* ── 3. Pantry alert ─────────────────────────────────── */}
        {expiring.length === 0 ? (
          <div
            className="fade-up"
            style={{
              animationDelay: '60ms',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 13px', borderRadius: 11,
              background: T.successTint, border: `1px solid ${T.successBord}`,
              color: T.success, fontSize: 12.5, fontWeight: 600,
              marginBottom: 16,
            }}
          >
            ✓ {t('allFresh')}
          </div>
        ) : (
          <div
            className="fade-up"
            style={{
              animationDelay: '60ms',
              marginBottom: 12,
              padding: '14px 14px 12px',
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 14,
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
              textTransform: 'uppercase', marginBottom: 10,
              color: expiringToday >= 1 ? T.danger : T.warning,
            }}>
              {expiringToday >= 1
                ? (expiringToday === 1
                    ? t('oneUsingToday')
                    : t('nUsingToday', { n: expiringToday }))
                : t('nUsingSoon', { n: expiring.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {expiring.map(it => {
                const d = daysUntil(it.expiresOn);
                const when = d === null ? '' :
                  d < 0 ? t('expired') :
                  d === 0 ? t('expiresToday') :
                  `${d}${t('daysShort')}`;
                return (
                  <div key={it.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, color: T.text,
                  }}>
                    <span>{it.name}</span>
                    <span style={{ color: (d ?? 999) <= 1 ? T.danger : T.muted, fontSize: 12, fontWeight: 600 }}>
                      {when}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 4. Recipe of the Day ────────────────────────────── */}
        <RecipeOfDayCard
          meal={meal}
          loading={mealLoading}
          error={mealError}
          onRefresh={handleRefreshMeal}
          refreshing={mealRefreshing}
          badge={t('recipeOfDay')}
          viewLabel={t('viewRecipe')}
          index={2}
        />

        {/* ── 5. Food Fact ────────────────────────────────────── */}
        <FactCard
          fact={fact}
          badge={t('foodFact')}
          index={3}
        />

        {/* ── 6. Seasonal Spotlight ───────────────────────────── */}
        <SeasonalCard
          season={season}
          picks={picks}
          badge={t('inSeason')}
          seasonLabel={t('seasonLabel')}
          index={4}
        />

        {/* ── 7. Generate CTA ─────────────────────────────────── */}
        <div
          className="fade-up"
          style={{ animationDelay: '300ms', marginTop: 8 }}
        >
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => navigate('/generate')}
            className="press"
            style={{
              width: '100%',
              border: `1px solid ${canGenerate ? T.borderAcc : T.border}`,
              background: canGenerate ? T.accentTint : T.surface,
              borderRadius: 14,
              padding: '16px 20px',
              color: canGenerate ? T.accent : T.muted,
              fontFamily: T.font,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.4 }}>
                {t('generateRecipe')}
              </div>
              <div style={{ fontSize: 12, color: canGenerate ? T.accent2 : T.mute2, marginTop: 3 }}>
                {t('threeOptionsNote')}
              </div>
            </div>
            <ArrowRight size={20} />
          </button>
        </div>

      </div>
    </Screen>
  );
}
