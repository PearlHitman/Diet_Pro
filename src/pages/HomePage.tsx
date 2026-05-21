// Home — Mise Liquid Glass.
// Time-aware greeting, two glass CTA cards, optional API-key banner only.

import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Refrigerator, Lightbulb, ChevronRight, AlertCircle } from 'lucide-react';
import { Screen, AppHeader } from '../components/Chrome';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { computeNutritionGoals, sumMeals, toDateStr } from '../lib/nutrition';
import { prefersReducedMotion } from '../lib/motion';
import type { DayTotals } from '../lib/nutrition';
import type { NutritionGoals } from '../lib/types';

const ctaCardBtn: React.CSSProperties = {
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)',
  cursor: 'pointer',
  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  boxSizing: 'border-box',
  width: '100%',
};
const ctaCardIconWrap: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 15,  // size * 0.32
  background: 'var(--primary-dim)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const ctaCardTextCol: React.CSSProperties = { flex: 1, minWidth: 0 };
const ctaCardTitle: React.CSSProperties = {
  fontSize: T.fontSize.lead,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  marginBottom: 2,
};
const ctaCardSubtitle: React.CSSProperties = {
  fontSize: T.fontSize.bodyLg,
  lineHeight: 1.35,
  color: 'var(--text-2)',
  fontFamily: 'var(--font-sans)',
};
const ctaCardChevron: React.CSSProperties = { color: 'var(--text-3)', flexShrink: 0 };

function greetingKey(): 'homeGreetingMorning' | 'homeGreetingAfternoon' | 'homeGreetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'homeGreetingMorning';
  if (h < 17) return 'homeGreetingAfternoon';
  return 'homeGreetingEvening';
}

export function HomePage() {
  const { pantry, profile, settings, bodyStats, nutritionLog, t } = useApp();
  const navigate = useNavigate();

  const goals = useMemo(
    () => computeNutritionGoals(bodyStats, profile.dietGoal),
    [bodyStats, profile.dietGoal],
  );
  const todayTotals = useMemo(() => {
    const today = toDateStr();
    return sumMeals(nutritionLog.filter(m => m.date === today));
  }, [nutritionLog]);

  const needsKey = !settings.apiKey;
  const pantryCount = pantry.length;
  const card1Enough = pantryCount >= 2;

  const gk = greetingKey();
  const greetBase = t(gk); // e.g. "Good morning"
  const userName  = profile.name.trim();
  const reduceMotion = prefersReducedMotion();

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '8px 20px 28px' }}>
        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={{ ...(!reduceMotion ? { animationDelay: '0ms' } : {}), marginBottom: 28 }}
        >
          {/* Display-serif greeting hero — name in italic primary */}
          <h1
            style={{
              fontSize: T.fontSize.displayXl,
              fontWeight: 400,           /* Instrument Serif at regular weight */
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              marginBottom: 8,
            }}
          >
            {greetBase}
            {userName ? (
              <>
                ,{' '}
                <em style={{ fontStyle: 'italic', color: 'var(--primary)' }}>
                  {userName}
                </em>
              </>
            ) : null}
          </h1>
          <p
            style={{
              fontSize: T.fontSize.bodyLg,
              lineHeight: 1.5,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-sans)',
              margin: 0,
            }}
          >
            {t('homeSubtitleWhatsCooking')}
          </p>
        </div>

        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={{
            ...(!reduceMotion ? { animationDelay: '60ms' } : {}),
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <CTACard
            icon={<Refrigerator size={24} style={{ color: 'var(--primary)' }} />}
            title={t('cookFromPantry')}
            subtitle={
              card1Enough
                ? t('nIngredientsInPantry', { n: pantryCount })
                : t('pantryCardNeedMoreHint')
            }
            onClick={() => navigate(card1Enough ? '/generate' : '/pantry')}
          />
          <CTACard
            icon={<Lightbulb size={24} style={{ color: 'var(--primary)' }} />}
            title={t('haveDishInMind')}
            subtitle={t('haveDishInMindSub')}
            onClick={() => navigate('/dish')}
          />
        </div>

        {/* Nutrition card */}
        <NutritionCard goals={goals} totals={todayTotals} onClick={() => navigate('/nutrition')} />

        {needsKey && (
          <Link to="/settings" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div
              className={reduceMotion ? undefined : 'fade-up'}
              style={{
                ...(!reduceMotion ? { animationDelay: '120ms' } : {}),
                padding: '14px 16px',
                background: 'rgba(245, 158, 11, 0.10)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-button)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--text)',
                fontSize: T.fontSize.body,
                boxShadow: 'var(--mise-shadow-sm)',
              }}
            >
              <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t('errorNoKey')}</span>
              <ChevronRight size={16} style={{ color: 'var(--warning)' }} />
            </div>
          </Link>
        )}
      </div>
    </Screen>
  );
}

function NutritionCard({
  goals,
  totals,
  onClick,
}: {
  goals: NutritionGoals | null;
  totals: DayTotals;
  onClick: () => void;
}) {
  const reduceMotion = prefersReducedMotion();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // Empty state: body stats not configured yet.
  if (!goals) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="press"
        style={{
          all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
          padding: '16px 18px', marginTop: 14,
          background: 'var(--primary-dim)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: T.fontSize.small, fontWeight: 600, color: 'var(--primary)', marginBottom: 4, letterSpacing: 0.3 }}>
          TODAY'S NUTRITION
        </div>
        <div style={{ fontSize: T.fontSize.body, color: 'var(--text-2)', lineHeight: 1.4 }}>
          Set up your body stats in Profile to track daily nutrition goals →
        </div>
      </button>
    );
  }

  const calPct = Math.min(totals.calories / goals.calories, 1);
  // SVG ring math: r=28, circumference=2π×28≈175.9
  const CIRC = 175.9;
  const dash = calPct * CIRC;
  const gap  = CIRC - dash;

  const macros = [
    { label: 'Protein', value: totals.protein,  goal: goals.protein,  color: 'var(--protein)' },
    { label: 'Carbs',   value: totals.carbs,    goal: goals.carbs,    color: 'var(--carbs)' },
    { label: 'Fat',     value: totals.fat,       goal: goals.fat,      color: 'var(--fat)' },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
        padding: '16px 18px', marginTop: 14,
        background: 'var(--primary-dim)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-card)',
        cursor: 'pointer',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: T.fontSize.small, fontWeight: 600, color: 'var(--primary)', letterSpacing: 0.3 }}>
          TODAY'S NUTRITION
        </div>
        <div style={{
          fontSize: T.fontSize.tiny, color: 'var(--primary)',
          background: 'var(--primary-dim)', padding: '3px 8px', borderRadius: 99,
        }}>
          {dateLabel}
        </div>
      </div>

      {/* Ring + macro bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Calorie ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--primary-dim)" strokeWidth="7" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke="var(--primary)" strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
            />
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', textAlign: 'center',
          }}>
            <div style={{ fontSize: calPct >= 0.1 ? T.fontSize.small : T.fontSize.tiny, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {totals.calories.toLocaleString()}
            </div>
            <div style={{ fontSize: T.fontSize.micro, color: 'var(--text-2)', marginTop: 2 }}>
              of {goals.calories.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {macros.map(m => {
            const pct = Math.min((m.value / m.goal) * 100, 100);
            return (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: T.fontSize.tiny, color: m.color, width: 44, flexShrink: 0 }}>{m.label}</div>
                <div style={{
                  flex: 1, height: 5, borderRadius: 99,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    borderRadius: 99, background: m.color,
                    ...(reduceMotion ? { transition: 'none' } : { transition: 'width 0.4s ease' }),
                  }} />
                </div>
                <div style={{ fontSize: T.fontSize.tiny, fontWeight: 600, color: 'var(--text)', width: 34, textAlign: 'right', flexShrink: 0 }}>
                  {m.value}<span style={{ fontSize: T.fontSize.micro, color: 'var(--text-2)' }}>g</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: T.fontSize.tiny, color: 'var(--primary)', textAlign: 'center', marginTop: 12, opacity: 0.8 }}>
        Tap for full breakdown →
      </div>
    </button>
  );
}

function CTACard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const reduceMotion = prefersReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        ...ctaCardBtn,
        ...(reduceMotion ? { transition: 'none' } : {}),
      }}
    >
      <div style={ctaCardIconWrap}>
        {icon}
      </div>
      <div style={ctaCardTextCol}>
        <div style={ctaCardTitle}>
          {title}
        </div>
        <div style={ctaCardSubtitle}>
          {subtitle}
        </div>
      </div>
      <ChevronRight size={20} style={ctaCardChevron} />
    </button>
  );
}
