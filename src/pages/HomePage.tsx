// Home — Mise Liquid Glass.
// Time-aware greeting, two glass CTA cards, optional API-key banner only.

import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Refrigerator, Lightbulb, ChevronRight, AlertCircle } from 'lucide-react';
import { Screen, AppHeader } from '../components/Chrome';
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
  padding: 20,
  background: 'var(--mise-glass-fill)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid var(--mise-glass-border)',
  borderRadius: 'var(--mise-radius-card)',
  boxShadow: 'var(--mise-shadow-glass)',
  cursor: 'pointer',
  transition: 'transform 0.3s var(--mise-ease-apple), box-shadow 0.3s var(--mise-ease-apple)',
  boxSizing: 'border-box',
  width: '100%',
};
const ctaCardIconWrap: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: 'rgba(124, 58, 237, 0.10)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const ctaCardTextCol: React.CSSProperties = { flex: 1, minWidth: 0 };
const ctaCardTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  lineHeight: '24px',
  color: 'var(--mise-text-primary)',
  fontFamily: 'var(--mise-font-text)',
  marginBottom: 2,
};
const ctaCardSubtitle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: '20px',
  color: 'var(--mise-text-secondary)',
  fontFamily: 'var(--mise-font-text)',
};
const ctaCardChevron: React.CSSProperties = { color: 'var(--mise-text-tertiary)', flexShrink: 0 };

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
  const greetLine =
    `${t(gk)}${profile.name.trim() ? `, ${profile.name.trim()}` : ''}`;
  const reduceMotion = prefersReducedMotion();

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '8px 20px 28px' }}>
        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={{ ...(!reduceMotion ? { animationDelay: '0ms' } : {}), marginBottom: 28 }}
        >
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
            {greetLine}
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
            icon={<Refrigerator size={24} style={{ color: 'var(--mise-primary)' }} />}
            title={t('cookFromPantry')}
            subtitle={
              card1Enough
                ? t('nIngredientsInPantry', { n: pantryCount })
                : t('pantryCardNeedMoreHint')
            }
            onClick={() => navigate(card1Enough ? '/generate' : '/pantry')}
          />
          <CTACard
            icon={<Lightbulb size={24} style={{ color: 'var(--mise-primary)' }} />}
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
          background: 'rgba(124,58,237,0.06)',
          border: '1px dashed rgba(124,58,237,0.3)',
          borderRadius: 'var(--mise-radius-card)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mise-primary)', marginBottom: 4, letterSpacing: 0.3 }}>
          TODAY'S NUTRITION
        </div>
        <div style={{ fontSize: 14, color: 'var(--mise-text-secondary)', lineHeight: 1.4 }}>
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
    { label: 'Protein', value: totals.protein,  goal: goals.protein,  color: '#F472B6' },
    { label: 'Carbs',   value: totals.carbs,    goal: goals.carbs,    color: '#60A5FA' },
    { label: 'Fat',     value: totals.fat,       goal: goals.fat,      color: '#34D399' },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
        padding: '16px 18px', marginTop: 14,
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.22)',
        borderRadius: 'var(--mise-radius-card)',
        cursor: 'pointer',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mise-primary)', letterSpacing: 0.3 }}>
          TODAY'S NUTRITION
        </div>
        <div style={{
          fontSize: 11, color: 'var(--mise-primary)',
          background: 'rgba(124,58,237,0.15)', padding: '3px 8px', borderRadius: 99,
        }}>
          {dateLabel}
        </div>
      </div>

      {/* Ring + macro bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Calorie ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(124,58,237,0.15)" strokeWidth="7" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke="var(--mise-primary)" strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
            />
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', textAlign: 'center',
          }}>
            <div style={{ fontSize: calPct >= 0.1 ? 13 : 11, fontWeight: 700, color: 'var(--mise-text-primary)', lineHeight: 1 }}>
              {totals.calories.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: 'var(--mise-text-secondary)', marginTop: 2 }}>
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
                <div style={{ fontSize: 11, color: m.color, width: 44, flexShrink: 0 }}>{m.label}</div>
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
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mise-text-primary)', width: 34, textAlign: 'right', flexShrink: 0 }}>
                  {m.value}<span style={{ fontSize: 9, color: 'var(--mise-text-secondary)' }}>g</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--mise-primary)', textAlign: 'center', marginTop: 12, opacity: 0.8 }}>
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
