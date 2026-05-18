// Home — Mise Liquid Glass.
// Greeting hero + two primary glass CTA cards (per Figma), with the
// existing pantry/feed surface area folded in below as glass cards.

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Refrigerator,
  Lightbulb,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Screen, AppHeader } from '../components/Chrome';
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

      <div style={{ padding: '8px 20px 28px' }}>
        {/* ── Greeting hero ─────────────────────────────────── */}
        <div className="fade-up" style={{ animationDelay: '0ms', marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: '40px',
              letterSpacing: -0.6,
              color: 'var(--mise-text-primary)',
              fontFamily: 'var(--mise-font-display)',
              marginBottom: 6,
            }}
          >
            {greetLine}{todEmoji ? ` ${todEmoji}` : ''}
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: '24px',
              color: 'var(--mise-text-secondary)',
              fontFamily: 'var(--mise-font-text)',
              margin: 0,
            }}
          >
            {greetSub}
          </p>

          {(profile.cuisine || pantry.length > 0) && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                fontSize: 13,
                color: 'var(--mise-text-secondary)',
              }}
            >
              {profile.cuisine && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 11px',
                    background: 'var(--mise-glass-fill)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--mise-glass-border)',
                    borderRadius: 'var(--mise-radius-pill)',
                    color: 'var(--mise-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{flag}</span>
                  <span>{profile.cuisine}</span>
                </span>
              )}
              {pantry.length > 0 && (
                <span>
                  {t('youHave')}{' '}
                  <strong style={{ color: 'var(--mise-text-primary)', fontWeight: 600 }}>
                    {pantry.length}
                  </strong>{' '}
                  {t('ingredients')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Two primary glass CTA cards (Figma port) ─────── */}
        <div
          className="fade-up"
          style={{ animationDelay: '60ms', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}
        >
          <CTACard
            icon={<Refrigerator size={24} style={{ color: 'var(--mise-primary)' }} />}
            title={t('cookFromPantry')}
            subtitle={
              pantry.length > 0
                ? t('nIngredientsInPantry', { n: pantry.length })
                : t('emptyPantryHint')
            }
            disabled={!canGenerate}
            onClick={() => navigate('/generate')}
          />
          <CTACard
            icon={<Lightbulb size={24} style={{ color: 'var(--mise-primary)' }} />}
            title={t('haveDishInMind')}
            subtitle={t('haveDishInMindSub')}
            disabled={!settings.apiKey}
            onClick={() => navigate('/generate?mode=specific')}
          />
        </div>

        {/* ── API key warning ───────────────────────────────── */}
        {needsKey && (
          <Link to="/settings" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div
              className="fade-up"
              style={{
                animationDelay: '120ms',
                padding: '14px 16px',
                background: 'rgba(245, 158, 11, 0.10)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--mise-radius-button)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--mise-text-primary)',
                fontSize: 14,
                boxShadow: 'var(--mise-shadow-sm)',
              }}
            >
              <AlertCircle size={18} style={{ color: 'var(--mise-warning)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t('errorNoKey')}</span>
              <ChevronRight size={16} style={{ color: 'var(--mise-warning)' }} />
            </div>
          </Link>
        )}

        {/* ── Pantry expiring alert ─────────────────────────── */}
        {expiring.length === 0 ? (
          <div
            className="fade-up"
            style={{
              animationDelay: '160ms',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 'var(--mise-radius-pill)',
              background: 'rgba(16, 185, 129, 0.10)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--mise-success)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            ✓ {t('allFresh')}
          </div>
        ) : (
          <div
            className="fade-up"
            style={{
              animationDelay: '160ms',
              marginBottom: 20,
              padding: '16px 18px 14px',
              background: 'var(--mise-glass-fill)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid var(--mise-glass-border)',
              borderRadius: 'var(--mise-radius-card)',
              boxShadow: 'var(--mise-shadow-glass)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 12,
                color: expiringToday >= 1 ? 'var(--mise-error)' : 'var(--mise-warning)',
              }}
            >
              {expiringToday >= 1
                ? expiringToday === 1
                  ? t('oneUsingToday')
                  : t('nUsingToday', { n: expiringToday })
                : t('nUsingSoon', { n: expiring.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {expiring.map(it => {
                const d = daysUntil(it.expiresOn);
                const when =
                  d === null
                    ? ''
                    : d < 0
                      ? t('expired')
                      : d === 0
                        ? t('expiresToday')
                        : `${d}${t('daysShort')}`;
                return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontSize: 14,
                      color: 'var(--mise-text-primary)',
                    }}
                  >
                    <span>{it.name}</span>
                    <span
                      style={{
                        color: (d ?? 999) <= 1 ? 'var(--mise-error)' : 'var(--mise-text-secondary)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {when}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Feed: Recipe of the Day / Fact / Seasonal ─────── */}
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
        <FactCard fact={fact} badge={t('foodFact')} index={3} />
        <SeasonalCard
          season={season}
          picks={picks}
          badge={t('inSeason')}
          seasonLabel={t('seasonLabel')}
          index={4}
        />
      </div>
    </Screen>
  );
}

/* ─── Glass CTA card (Figma) ───────────────────────────────── */

function CTACard({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="press"
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 20,
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-card)',
        boxShadow: 'var(--mise-shadow-glass)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'transform 0.3s var(--mise-ease-apple), box-shadow 0.3s var(--mise-ease-apple)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'rgba(124, 58, 237, 0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            lineHeight: '24px',
            color: 'var(--mise-text-primary)',
            fontFamily: 'var(--mise-font-text)',
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: '20px',
            color: 'var(--mise-text-secondary)',
            fontFamily: 'var(--mise-font-text)',
          }}
        >
          {subtitle}
        </div>
      </div>
      <ChevronRight
        size={20}
        style={{ color: 'var(--mise-text-tertiary)', flexShrink: 0 }}
      />
    </button>
  );
}
