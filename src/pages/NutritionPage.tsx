// Nutrition page — Today / Week / Month tabs + Add Food sheet.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { useApp } from '../lib/app-state';
import { buildNutritionEstimatePrompt } from '../lib/prompts';
import { prefersReducedMotion } from '../lib/motion';
import { callClaude, parseJsonLoose, ClaudeError } from '../lib/claude';
import {
  computeNutritionGoals, sumMeals, toDateStr, lastNDays,
  type DayTotals,
} from '../lib/nutrition';
import type { LoggedMeal, NutritionGoals } from '../lib/types';

// ─── helpers ─────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Main page ───────────────────────────────────────────────

type Tab = 'today' | 'week' | 'month';

export function NutritionPage() {
  const { profile, bodyStats, nutritionLog, addLoggedMeal, removeLoggedMeal, settings } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('today');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const goals = useMemo(
    () => computeNutritionGoals(bodyStats, profile.dietGoal),
    [bodyStats, profile.dietGoal],
  );

  const today = toDateStr();
  const todayMeals = useMemo(() => nutritionLog.filter(m => m.date === today), [nutritionLog, today]);
  const todayTotals = useMemo(() => sumMeals(todayMeals), [todayMeals]);

  const reduceMotion = prefersReducedMotion();

  return (
    <Screen>
      <SubHeader title="Nutrition" onBack={() => navigate(-1)} />

      <div style={{ padding: '14px 16px 80px' }}>
        {/* Segmented control */}
        <div style={{
          display: 'flex', background: 'var(--mise-glass-fill)',
          border: '1px solid var(--mise-glass-border)',
          borderRadius: 'var(--mise-radius-button)', padding: 3, marginBottom: 18,
        }}>
          {(['today', 'week', 'month'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', border: 'none',
                borderRadius: 11, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: 'var(--mise-font-text)',
                background: tab === t ? 'var(--mise-primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--mise-text-secondary)',
                ...(reduceMotion ? { transition: 'none' } : { transition: 'background 0.2s ease, color 0.2s ease' }),
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <TodayTab
            goals={goals}
            totals={todayTotals}
            meals={todayMeals}
            onRemove={removeLoggedMeal}
            onAdd={() => setShowAddSheet(true)}
            navigate={navigate}
          />
        )}
        {tab === 'week'  && <WeekTab  goals={goals} log={nutritionLog} />}
        {tab === 'month' && <MonthTab goals={goals} log={nutritionLog} />}
      </div>

      {showAddSheet && (
        <AddFoodSheet
          apiKey={settings.apiKey}
          onClose={() => setShowAddSheet(false)}
          onConfirm={async (meal) => {
            await addLoggedMeal({ ...meal, id: uid(), date: today });
            setShowAddSheet(false);
          }}
        />
      )}
    </Screen>
  );
}

// ─── Today tab ───────────────────────────────────────────────

function TodayTab({
  goals,
  totals,
  meals,
  onRemove,
  onAdd,
  navigate,
}: {
  goals: NutritionGoals | null;
  totals: DayTotals;
  meals: LoggedMeal[];
  onRemove: (id: string) => void;
  onAdd: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (!goals) {
    return (
      <div style={{
        padding: '32px 16px', textAlign: 'center',
        color: 'var(--mise-text-secondary)', fontSize: 15, lineHeight: 1.6,
      }}>
        Set up your body stats in{' '}
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--mise-primary)', fontWeight: 600, fontSize: 15,
            fontFamily: 'var(--mise-font-text)', padding: 0,
          }}
        >
          Profile
        </button>
        {' '}to see your daily nutrition targets.
      </div>
    );
  }

  const calPct = Math.min(totals.calories / goals.calories, 1);
  const CIRC = 351.9; // 2π × 56
  const dash = calPct * CIRC;
  const gap  = CIRC - dash;
  const remaining = Math.max(goals.calories - totals.calories, 0);

  const macros = [
    { label: 'Protein', value: totals.protein, goal: goals.protein, color: '#F472B6' },
    { label: 'Carbs',   value: totals.carbs,   goal: goals.carbs,   color: '#60A5FA' },
    { label: 'Fat',     value: totals.fat,      goal: goals.fat,     color: '#34D399' },
  ];

  return (
    <>
      {/* Big calorie ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r="56" fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth="14" />
          <circle
            cx="80" cy="80" r="56" fill="none"
            stroke="var(--mise-primary)" strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--mise-text-primary)', lineHeight: 1 }}>
            {totals.calories.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mise-text-secondary)', marginTop: 3 }}>kcal consumed</div>
          <div style={{ fontSize: 13, color: 'var(--mise-primary)', marginTop: 4, fontWeight: 500 }}>
            {remaining.toLocaleString()} remaining
          </div>
        </div>
      </div>

      {/* Macro cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
        {macros.map(m => {
          const pct = Math.min((m.value / m.goal) * 100, 100);
          return (
            <div key={m.label} style={{
              background: 'var(--mise-glass-fill)', border: '1px solid var(--mise-glass-border)',
              borderRadius: 14, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'var(--mise-text-secondary)', marginTop: 2 }}>g / {m.goal}g</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.color, marginTop: 4 }}>{m.label}</div>
              <div style={{
                height: 4, borderRadius: 99, marginTop: 6,
                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
              }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: m.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Meals list */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mise-text-tertiary)', letterSpacing: 0.5, marginBottom: 10 }}>
        TODAY'S MEALS
      </div>

      {meals.length === 0 && (
        <div style={{
          padding: '20px 0', textAlign: 'center',
          fontSize: 14, color: 'var(--mise-text-tertiary)',
        }}>
          No meals logged yet
        </div>
      )}

      {meals.map(meal => (
        <MealRow key={meal.id} meal={meal} onRemove={onRemove} />
      ))}

      {/* Add food button */}
      <button
        type="button"
        onClick={onAdd}
        style={{
          width: '100%', padding: 14, marginTop: 8,
          background: 'rgba(124,58,237,0.08)',
          border: '1px dashed rgba(124,58,237,0.35)',
          borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'var(--mise-primary)', fontSize: 14, fontWeight: 600,
          fontFamily: 'var(--mise-font-text)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        Add food
      </button>
    </>
  );
}

function MealRow({ meal, onRemove }: { meal: LoggedMeal; onRemove: (id: string) => void }) {
  const SOURCE_EMOJI: Record<LoggedMeal['source'], string> = { recipe: '🍳', manual: '✏️' };
  const SOURCE_LABEL: Record<LoggedMeal['source'], string> = { recipe: 'from recipe', manual: 'manual entry' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--mise-glass-fill)', border: '1px solid var(--mise-glass-border)',
      borderRadius: 14, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: meal.source === 'recipe' ? 'rgba(124,58,237,0.12)' : 'rgba(245,158,11,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {SOURCE_EMOJI[meal.source]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--mise-text-primary)',
          marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meal.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mise-text-tertiary)' }}>
          {SOURCE_LABEL[meal.source]} · P {Math.round(meal.protein * meal.servings)}g · C {Math.round(meal.carbs * meal.servings)}g · F {Math.round(meal.fat * meal.servings)}g
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mise-primary)', flexShrink: 0, marginRight: 8 }}>
        {Math.round(meal.calories * meal.servings)} kcal
      </div>
      <button
        type="button"
        onClick={() => onRemove(meal.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: 'var(--mise-text-tertiary)', flexShrink: 0,
        }}
        aria-label="Remove meal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  );
}

// ─── Week tab ────────────────────────────────────────────────

function WeekTab({ goals, log }: { goals: NutritionGoals | null; log: LoggedMeal[] }) {
  const days = lastNDays(7);
  const data = days.map(date => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
    totals: sumMeals(log.filter(m => m.date === date)),
    isToday: date === toDateStr(),
  }));

  const target = goals?.calories ?? 2000;
  const maxVal = Math.max(...data.map(d => d.totals.calories), target, 1);

  const avgCal = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.totals.calories, 0) / data.filter(d => d.totals.calories > 0).length || 0)
    : 0;

  const onTargetCount = data.filter(d =>
    d.totals.calories > 0 && Math.abs(d.totals.calories - target) / target < 0.15,
  ).length;

  return (
    <>
      {/* Bar chart */}
      <div style={{
        background: 'var(--mise-glass-fill)', border: '1px solid var(--mise-glass-border)',
        borderRadius: 18, padding: 16, marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mise-text-tertiary)', letterSpacing: 0.5, marginBottom: 14 }}>
          DAILY CALORIES VS TARGET
        </div>

        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginBottom: 6 }}>
          {data.map(d => {
            const barH = d.totals.calories > 0 ? Math.round((d.totals.calories / maxVal) * 90) : 0;
            const targetH = Math.round((target / maxVal) * 90);
            const over = goals && d.totals.calories > goals.calories * 1.05;
            const barColor = d.isToday ? 'var(--mise-primary)' : over ? 'var(--mise-error)' : 'var(--mise-success)';

            return (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                  {/* target line */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    bottom: targetH, height: 1,
                    background: 'rgba(124,58,237,0.35)',
                  }} />
                  {/* bar */}
                  <div style={{
                    width: '100%', height: barH || 3,
                    borderRadius: '5px 5px 0 0',
                    background: d.totals.calories > 0 ? barColor : 'rgba(255,255,255,0.06)',
                    opacity: d.isToday ? 1 : 0.65,
                  }} />
                </div>
                <div style={{
                  fontSize: 10, color: d.isToday ? 'var(--mise-primary)' : 'var(--mise-text-tertiary)',
                  fontWeight: d.isToday ? 600 : 400,
                }}>
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <div style={{ width: 20, height: 2, background: 'rgba(124,58,237,0.4)', borderRadius: 99 }} />
          <span style={{ fontSize: 10, color: 'var(--mise-text-tertiary)' }}>{target.toLocaleString()} kcal target</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Weekly avg" value={avgCal > 0 ? `${avgCal.toLocaleString()} kcal` : '—'}
          sub={avgCal > 0 && goals ? (avgCal < goals.calories ? `↓ ${(goals.calories - avgCal).toLocaleString()} under` : `↑ ${(avgCal - goals.calories).toLocaleString()} over`) : 'No data yet'}
          subColor={avgCal > 0 && goals ? (avgCal <= goals.calories ? 'var(--mise-success)' : 'var(--mise-error)') : 'var(--mise-text-tertiary)'}
        />
        <StatCard label="On-target days" value={`${onTargetCount} / 7`}
          sub="within ±15% of target"
          subColor="var(--mise-primary)"
        />
      </div>
    </>
  );
}

function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div style={{
      background: 'var(--mise-glass-fill)', border: '1px solid var(--mise-glass-border)',
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ fontSize: 11, color: 'var(--mise-text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mise-text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: subColor, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ─── Month tab ───────────────────────────────────────────────

function MonthTab({ goals, log }: { goals: NutritionGoals | null; log: LoggedMeal[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const target = goals?.calories ?? 0;

  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    log.forEach(m => {
      map[m.date] = (map[m.date] ?? 0) + Math.round(m.calories * m.servings);
    });
    return map;
  }, [log]);

  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function cellColor(day: number): string {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const kcal = byDate[dateStr] ?? 0;
    if (kcal === 0) return 'rgba(255,255,255,0.05)';
    if (!goals) return 'rgba(124,58,237,0.3)';
    const ratio = kcal / target;
    if (ratio > 1.1) return 'rgba(239,68,68,0.35)';
    return 'rgba(52,211,153,0.35)';
  }

  function textColor(day: number): string {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const kcal = byDate[dateStr] ?? 0;
    if (kcal === 0) return 'var(--mise-text-tertiary)';
    const ratio = goals ? kcal / target : 0;
    if (ratio > 1.1) return 'var(--mise-error)';
    return 'var(--mise-success)';
  }

  const trackedDays = Object.keys(byDate).filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const onTarget = Object.entries(byDate)
    .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .filter(([, kcal]) => goals ? kcal / goals.calories <= 1.1 : false).length;
  const monthAvg = trackedDays > 0
    ? Math.round(Object.entries(byDate).filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).reduce((s, [, v]) => s + v, 0) / trackedDays)
    : 0;

  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mise-text-primary)', marginBottom: 12 }}>
        {monthName}
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--mise-text-tertiary)', paddingBottom: 2 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 14 }}>
        {/* Empty cells before first day */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = day === now.getDate();
          return (
            <div key={day} style={{
              aspectRatio: '1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: cellColor(day),
              border: isToday ? '1.5px solid var(--mise-primary)' : 'none',
              fontSize: 11, fontWeight: isToday ? 700 : 400,
              color: textColor(day),
            }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { color: 'rgba(52,211,153,0.5)', label: 'On target' },
          { color: 'rgba(239,68,68,0.45)', label: 'Over' },
          { color: 'rgba(255,255,255,0.08)', label: 'No data' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            <span style={{ fontSize: 11, color: 'var(--mise-text-tertiary)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        background: 'var(--mise-glass-fill)', border: '1px solid var(--mise-glass-border)',
        borderRadius: 14, padding: 14,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mise-text-tertiary)', letterSpacing: 0.5, marginBottom: 10 }}>
          MONTH SUMMARY
        </div>
        {[
          { label: 'Days tracked', value: `${trackedDays} / ${now.getDate()}`, color: 'var(--mise-text-primary)' },
          { label: 'On-target days', value: `${onTarget}`, color: 'var(--mise-success)' },
          { label: 'Monthly avg', value: monthAvg > 0 ? `${monthAvg.toLocaleString()} kcal` : '—', color: 'var(--mise-text-primary)' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0',
            borderBottom: i < arr.length - 1 ? '1px solid var(--mise-glass-border)' : 'none',
          }}>
            <span style={{ fontSize: 13, color: 'var(--mise-text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Add Food sheet ──────────────────────────────────────────

interface EstimatedMeal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function AddFoodSheet({
  apiKey,
  onClose,
  onConfirm,
}: {
  apiKey: string;
  onClose: () => void;
  onConfirm: (meal: Omit<LoggedMeal, 'id' | 'date'>) => void;
}) {
  const [query, setQuery] = useState('');
  const [estimate, setEstimate] = useState<EstimatedMeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [servings, setServings] = useState(1);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced estimation
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 3) {
      setEstimate(null);
      setError('');
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      if (!apiKey) { setError('No API key — add one in Settings.'); return; }
      setLoading(true);
      setError('');
      try {
        const prompt = buildNutritionEstimatePrompt(query);
        const raw = await callClaude({ apiKey, model: 'claude-haiku-4-5', prompt, system: 'Return only valid JSON. No markdown fences.' });
        const parsed = parseJsonLoose(raw) as EstimatedMeal;
        if (
          typeof parsed !== 'object' || parsed === null ||
          typeof (parsed as { calories?: unknown }).calories !== 'number'
        ) {
          throw new Error('Unexpected response shape from Claude.');
        }
        setEstimate(parsed as EstimatedMeal);
      } catch (err) {
        if (err instanceof ClaudeError && err.kind === 'auth') {
          setError('API key missing or invalid — check Settings.');
        } else if (err instanceof ClaudeError && err.kind === 'rate') {
          setError('Rate limit hit — wait a moment and try again.');
        } else if (err instanceof ClaudeError && err.kind === 'parse') {
          setError('Claude returned unexpected data — try rephrasing.');
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Something went wrong — try again.');
        }
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, apiKey]);

  function handleConfirm() {
    if (!estimate) return;
    onConfirm({
      name: estimate.name,
      source: 'manual',
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      servings,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 98,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
        background: 'var(--mise-background)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid var(--mise-glass-border)',
        padding: '0 20px calc(env(safe-area-inset-bottom) + 24px)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--mise-glass-border)' }} />
        </div>

        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--mise-text-primary)', marginBottom: 16 }}>
          Add food
        </div>

        {/* Input */}
        <textarea
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Describe what you ate… e.g. 2 eggs and toast, large banana"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 14,
            border: '1px solid var(--mise-glass-border)',
            background: 'var(--mise-glass-fill)',
            color: 'var(--mise-text-primary)',
            fontSize: 15, fontFamily: 'var(--mise-font-text)',
            resize: 'none', outline: 'none',
          }}
        />

        {/* Loading */}
        {loading && (
          <div style={{ fontSize: 13, color: 'var(--mise-text-tertiary)', marginTop: 10, textAlign: 'center' }}>
            Estimating…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: 'var(--mise-error)', marginTop: 10 }}>{error}</div>
        )}

        {/* Estimate result */}
        {estimate && !loading && (
          <div style={{
            marginTop: 12, padding: '14px 16px',
            background: 'rgba(124,58,237,0.07)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mise-text-primary)', marginBottom: 8 }}>
              {estimate.name}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <MacroLine label="Calories" value={Math.round(estimate.calories * servings)} unit="kcal" color="var(--mise-primary)" />
              <MacroLine label="Protein"  value={Math.round(estimate.protein  * servings)} unit="g" color="#F472B6" />
              <MacroLine label="Carbs"    value={Math.round(estimate.carbs    * servings)} unit="g" color="#60A5FA" />
              <MacroLine label="Fat"      value={Math.round(estimate.fat       * servings)} unit="g" color="#34D399" />
            </div>

            {/* Servings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--mise-text-secondary)' }}>Servings:</span>
              {[0.5, 1, 1.5, 2].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  style={{
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${servings === s ? 'var(--mise-primary)' : 'var(--mise-glass-border)'}`,
                    background: servings === s ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: servings === s ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
                    fontSize: 13, fontWeight: 600, fontFamily: 'var(--mise-font-text)',
                  }}
                >
                  ×{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: 14, borderRadius: 14,
              border: '1px solid var(--mise-glass-border)',
              background: 'transparent',
              color: 'var(--mise-text-secondary)',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!estimate || loading}
            style={{
              flex: 2, padding: 14, borderRadius: 14,
              border: 'none',
              background: estimate && !loading ? 'var(--mise-primary)' : 'rgba(124,58,237,0.3)',
              color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: estimate ? 'pointer' : 'default',
              fontFamily: 'var(--mise-font-text)',
              boxShadow: estimate ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
            }}
          >
            Add to today
          </button>
        </div>
      </div>
    </>
  );
}

function MacroLine({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 6, height: 6, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mise-text-primary)' }}>{value}{unit}</span>
      <span style={{ fontSize: 11, color: 'var(--mise-text-tertiary)' }}>{label}</span>
    </div>
  );
}
