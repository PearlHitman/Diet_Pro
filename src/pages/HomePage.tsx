// Home — Mise v2 redesign.
// Unified hero card, expiring strip, redesigned nutrition card.

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Refrigerator, Zap, ArrowRight, Sparkles, Leaf, AlertCircle } from 'lucide-react';
import { Screen, AppHeader } from '../components/Chrome';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { computeNutritionGoals, sumMeals, toDateStr } from '../lib/nutrition';
import { prefersReducedMotion } from '../lib/motion';
import type { Ingredient, NutritionGoals } from '../lib/types';
import type { DayTotals } from '../lib/nutrition';

// ── Helpers ──────────────────────────────────────────────────

function daysLeft(expiresOn: string | null): number {
  if (!expiresOn) return Infinity;
  const ms = new Date(expiresOn).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function todayDateLabel(lang: 'EN' | 'EL' | 'ES'): string {
  const locale = lang === 'EL' ? 'el-GR' : lang === 'ES' ? 'es-ES' : 'en-US';
  return new Date().toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ── Section header ─────────────────────────────────────────────

function SectionHeader({
  label,
  trailing,
}: {
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--text-3)',
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </span>
      {trailing}
    </div>
  );
}

// ── Calorie ring — gradient stroke, animated ─────────────────

function CalorieRing({
  value, target, size = 92, stroke = 8,
}: {
  value: number; target: number; size?: number; stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / Math.max(1, target)));
  const offset = circ * (1 - pct);
  const reduceMotion = prefersReducedMotion();

  const circleRef = useRef<SVGCircleElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="calRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="#f0c590" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--surface-3)" strokeWidth={stroke} fill="none"
        />
        {/* Progress */}
        <circle
          ref={circleRef}
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#calRingGrad)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animated ? offset : circ}
          style={{
            transition: reduceMotion ? 'none' : 'stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: size * 0.28, fontWeight: 400, lineHeight: 1,
          color: 'var(--text)', fontFamily: 'var(--font-display)',
        }}>
          {value.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.3px', marginTop: 2 }}>
          of {target.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ── Macro bar ──────────────────────────────────────────────────

function MacroBar({
  label, value, max, color,
}: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = Math.min(1, value / Math.max(1, max));
  const reduceMotion = prefersReducedMotion();
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
          <span style={{ opacity: 0.6 }}> / {max}g</span>
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%', background: color,
          borderRadius: 999,
          transition: reduceMotion ? 'none' : 'width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export function HomePage() {
  const { pantry, profile, settings, bodyStats, nutritionLog, t } = useApp();
  const navigate = useNavigate();
  const reduceMotion = prefersReducedMotion();

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t('homeGreetingMorning')
    : hour < 17
    ? t('homeGreetingAfternoon')
    : t('homeGreetingEvening');
  const userName = profile.name.trim();

  // Date sub-line
  const dateLabel = todayDateLabel(profile.language as 'EN' | 'EL' | 'ES');

  // Expiring items (daysLeft <= 5, sorted asc)
  const expiring = useMemo(() => {
    return pantry
      .map(item => ({ item, days: daysLeft(item.expiresOn) }))
      .filter(({ days }) => days <= 5)
      .sort((a, b) => a.days - b.days);
  }, [pantry]);

  // Nutrition
  const goals = useMemo(
    () => computeNutritionGoals(bodyStats, profile.dietGoal),
    [bodyStats, profile.dietGoal],
  );
  const today = toDateStr();
  const todayMeals = useMemo(() => nutritionLog.filter(m => m.date === today), [nutritionLog, today]);
  const totals = useMemo(() => sumMeals(todayMeals), [todayMeals]);

  const needsKey = !settings.apiKey;

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '0 18px 28px' }}>

        {/* ── Greeting hero ──────────────────────────────────── */}
        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={{ padding: '14px 0 26px' }}
        >
          <h1 style={{
            fontSize: T.fontSize.displayXl,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            margin: 0,
          }}>
            {greeting},
            {userName ? (
              <>
                <br />
                <em style={{ fontStyle: 'italic', color: 'var(--primary)' }}>{userName}</em>
              </>
            ) : null}
          </h1>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
            {dateLabel} · {pantry.length} {t('itemsInPantry')}
          </div>
        </div>

        {/* ── Hero CTA card (unified) ────────────────────────── */}
        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={reduceMotion ? {} : { animationDelay: '60ms' }}
        >
          <div style={{
            background: 'linear-gradient(140deg, #2a1a12 0%, #1a120e 100%)',
            border: '1px solid rgba(224,132,86,0.2)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
          }}
            onClick={() => navigate('/generate')}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate('/generate')}
          >
            {/* Ambient glow blob */}
            <div style={{
              position: 'absolute', top: -50, right: -40,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, var(--primary-glow), transparent 70%)',
              opacity: 0.6, pointerEvents: 'none',
            }} />

            {/* Top region */}
            <div style={{ padding: '22px 22px 20px', position: 'relative' }}>
              <div style={{
                fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--primary)',
                fontFamily: 'var(--font-sans)', marginBottom: 10,
              }}>
                AI · Mise en place
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.4px',
                color: 'var(--text)', marginBottom: 16,
              }}>
                What are we cooking{' '}
                <em style={{ fontStyle: 'italic' }}>today</em>?
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Primary generate button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); navigate('/generate'); }}
                  style={{
                    flex: 1, display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                    padding: '13px 18px', borderRadius: 16, border: 'none',
                    background: 'var(--primary)', color: 'var(--on-primary)',
                    fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 8px 24px var(--primary-glow)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Sparkles size={18} />
                  Generate a recipe
                </button>
                {/* Circle arrow */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); navigate('/generate'); }}
                  style={{
                    width: 46, height: 46, borderRadius: 46,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text)', flexShrink: 0,
                  }}
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>

            {/* Sub-paths (bottom row) */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderTop: '1px solid var(--border)',
            }}>
              {/* From pantry */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); navigate('/generate'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '16px 18px', background: 'transparent',
                  border: 'none', borderRight: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Refrigerator size={18} color="var(--success)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t('fromPantry')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {pantry.length} {t('itemsShort')}
                  </div>
                </div>
              </button>
              {/* A dish in mind */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); navigate('/dish'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '16px 18px', background: 'transparent',
                  border: 'none',
                  color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Zap size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t('haveDishInMind')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {t('haveDishInMindSub')}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Use it before it goes ─────────────────────────── */}
        {expiring.length > 0 && (
          <div
            className={reduceMotion ? undefined : 'fade-up'}
            style={{
              marginTop: 28,
              ...(reduceMotion ? {} : { animationDelay: '80ms' }),
            }}
          >
            <SectionHeader
              label={t('useItBefore')}
              trailing={
                <button
                  type="button"
                  onClick={() => navigate('/pantry')}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {t('seeAll')}
                </button>
              }
            />
            <div style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              margin: '0 -18px', padding: '0 18px 4px',
              scrollbarWidth: 'none',
            }}>
              {expiring.slice(0, 5).map(({ item, days }) => (
                <ExpiringCard key={item.id} item={item} days={days} onTap={() => navigate('/generate')} />
              ))}
            </div>
          </div>
        )}

        {/* ── Today's nutrition ─────────────────────────────── */}
        <div
          className={reduceMotion ? undefined : 'fade-up'}
          style={{
            marginTop: 28,
            ...(reduceMotion ? {} : { animationDelay: '100ms' }),
          }}
        >
          <SectionHeader
            label={t('todaysNutrition')}
            trailing={
              <button
                type="button"
                onClick={() => navigate('/nutrition')}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {t('fullBreakdown')}
              </button>
            }
          />
          <NutritionCard goals={goals} totals={totals} mealCount={todayMeals.length} onClick={() => navigate('/nutrition')} />
        </div>

        {/* ── API key banner ───────────────────────────────── */}
        {needsKey && (
          <div
            className={reduceMotion ? undefined : 'fade-up'}
            style={{
              marginTop: 16,
              ...(reduceMotion ? {} : { animationDelay: '120ms' }),
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/settings')}
              style={{
                all: 'unset', display: 'flex', width: '100%', boxSizing: 'border-box',
                alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius-button)',
                cursor: 'pointer',
              }}
            >
              <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: T.fontSize.body, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                {t('errorNoKey')}
              </span>
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}

// ── Expiring card ──────────────────────────────────────────────

function ExpiringCard({
  item, days, onTap,
}: {
  item: Ingredient; days: number; onTap: () => void;
}) {
  const urgentColor = days <= 3 ? 'var(--danger)' : days <= 5 ? 'var(--warning)' : 'var(--success)';
  const cardBorder = days <= 3
    ? '1px solid rgba(196,101,74,0.32)'
    : '1px solid var(--border)';
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        all: 'unset',
        flex: '0 0 140px', boxSizing: 'border-box',
        background: 'var(--surface)',
        border: cardBorder,
        borderRadius: 18, padding: 14,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <Leaf size={20} color={urgentColor} />
        <span style={{
          fontSize: 11, color: urgentColor, fontWeight: 600,
          fontFamily: 'var(--font-mono)',
        }}>
          {days}d
        </span>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, lineHeight: 1.25, marginBottom: 2,
        color: 'var(--text)', fontFamily: 'var(--font-sans)',
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {item.name}
      </div>
      {item.amount && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
          {item.amount}
        </div>
      )}
    </button>
  );
}

// ── Nutrition card ─────────────────────────────────────────────

function NutritionCard({
  goals, totals, mealCount, onClick,
}: {
  goals: NutritionGoals | null;
  totals: DayTotals;
  mealCount: number;
  onClick: () => void;
}) {
  // Empty state
  if (!goals) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
          padding: '16px 18px',
          background: 'var(--surface)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ fontSize: T.fontSize.small, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>
          Set up your body stats in Profile to track daily nutrition goals →
        </div>
      </button>
    );
  }

  const remaining = Math.max(0, goals.calories - totals.calories);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        padding: 18,
      }}
    >
      {/* Ring + macro stack */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <CalorieRing value={totals.calories} target={goals.calories} size={92} stroke={8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MacroBar label="Protein" value={Math.round(totals.protein)} max={goals.protein} color="var(--protein)" />
          <MacroBar label="Carbs"   value={Math.round(totals.carbs)}   max={goals.carbs}   color="var(--carbs)" />
          <MacroBar label="Fat"     value={Math.round(totals.fat)}     max={goals.fat}      color="var(--fat)" />
        </div>
      </div>
      {/* Footer */}
      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
          {mealCount} meals · {remaining} kcal left
        </span>
        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          Full breakdown →
        </span>
      </div>
    </button>
  );
}
