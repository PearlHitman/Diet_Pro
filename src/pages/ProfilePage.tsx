// Profile page. Auto-saves with a small debounce so the "Saved" pill
// settles after the user stops typing.

import React, { useEffect, useRef, useState } from 'react';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, Segmented, Stepper } from '../components/Forms';
import { T } from '../tokens';
import { Globe, Check } from '../components/Icons';
import { useApp } from '../lib/app-state';
import type { ActivityLevel, BodyStats, DietGoal, Language, Level, Profile, Sex } from '../lib/types';
import { computeNutritionGoals } from '../lib/nutrition';

const DEFAULT_BODY_STATS: BodyStats = {
  sex: 'male',
  age: 30,
  weight: 75,
  height: 175,
  activityLevel: 'moderate',
};

export function ProfilePage() {
  const { profile, saveProfile, bodyStats, saveBodyStats, t } = useApp();
  const [local, setLocal] = useState<Profile>(profile);
  const [localBody, setLocalBody] = useState<BodyStats>(bodyStats ?? DEFAULT_BODY_STATS);
  const bodyTimer = useRef<number | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Keep local in sync if profile/bodyStats changes externally (rare).
  useEffect(() => { setLocal(profile); }, [profile]);
  useEffect(() => { if (bodyStats) setLocalBody(bodyStats); }, [bodyStats]);

  function updateBody<K extends keyof BodyStats>(k: K, v: BodyStats[K]) {
    const next = { ...localBody, [k]: v };
    setLocalBody(next);
    if (bodyTimer.current) window.clearTimeout(bodyTimer.current);
    bodyTimer.current = window.setTimeout(async () => {
      await saveBodyStats(next);
      setShowSaved(true);
      window.setTimeout(() => setShowSaved(false), 1400);
    }, 350);
  }

  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    const next = { ...local, [k]: v };
    setLocal(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveProfile(next);
      setShowSaved(true);
      window.setTimeout(() => setShowSaved(false), 1400);
    }, 350);
  }

  return (
    <Screen>
      <SubHeader
        title={t('profile')}
        right={showSaved ? <SavedPill label={t('saved')} /> : null}
      />

      <div style={{ padding: '16px 20px 28px' }}>
        {/* Identity card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, marginBottom: 22,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 999,
            background: T.accentTint, border: `1px solid ${T.borderAcc}`,
            color: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 700,
          }}>{local.name ? local.name[0].toUpperCase() : '?'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              {local.name || '—'}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {local.cuisine || '—'} · {t(local.level === 'Beginner' ? 'beginner' : local.level === 'Expert' ? 'expert' : 'intermediate')}
            </div>
          </div>
        </div>

        <Field label={t('yourName')}>
          <Input value={local.name} onChange={v => update('name', v)} />
        </Field>

        <Field label={t('preferredCuisine')} hint={t('preferredCuisineHint')}>
          <Input value={local.cuisine} onChange={v => update('cuisine', v)} placeholder="Mediterranean" />
        </Field>

        <Field label={t('servings')}>
          <Stepper value={local.servings} onChange={n => update('servings', n)} min={1} max={12} />
        </Field>

        <Field label={t('cookingLevel')}>
          <Segmented<Level>
            value={local.level}
            onChange={v => update('level', v)}
            options={[
              { value: 'Beginner', label: t('beginner') },
              { value: 'Intermediate', label: t('intermediate') },
              { value: 'Expert', label: t('expert') },
            ]}
          />
        </Field>

        <Field label={t('allergies')} hint={t('allergiesHint')}>
          <Input value={local.allergies} onChange={v => update('allergies', v)} placeholder="Shellfish, peanuts" />
        </Field>

        <Field label={t('dietGoal')}>
          <Segmented<DietGoal>
            value={local.dietGoal}
            onChange={v => update('dietGoal', v)}
            options={[
              { value: 'None', label: t('goalNone') },
              { value: 'Weight loss', label: t('goalWeight') },
              { value: 'Muscle', label: t('goalMuscle') },
              { value: 'Health', label: t('goalHealth') },
            ]}
          />
        </Field>

        {/* Body & Goals */}
        <BodyStatsSection
          stats={localBody}
          dietGoal={local.dietGoal}
          onChange={updateBody}
        />

        {/* Language */}
        <div style={{
          marginTop: 18, padding: '14px 16px',
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Globe size={16} color={T.muted} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t('language')}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{t('languageHint')}</div>
          </div>
          <Segmented<Language>
            value={local.language}
            onChange={v => update('language', v)}
            options={[{ value: 'EL', label: 'EL' }, { value: 'EN', label: 'EN' }, { value: 'ES', label: 'ES' }]}
          />
        </div>
      </div>
    </Screen>
  );
}

function BodyStatsSection({
  stats,
  dietGoal,
  onChange,
}: {
  stats: BodyStats;
  dietGoal: DietGoal;
  onChange: <K extends keyof BodyStats>(k: K, v: BodyStats[K]) => void;
}) {
  const goals = computeNutritionGoals(stats, dietGoal);

  const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
    sedentary:   'Sedentary',
    light:       'Light',
    moderate:    'Moderate',
    active:      'Active',
    very_active: 'Very active',
  };

  return (
    <div style={{ marginTop: 24 }}>
      {/* Section header */}
      <div style={{
        fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
        color: T.muted, marginBottom: 12,
      }}>
        BODY & GOALS
      </div>

      <Field label="Biological sex">
        <Segmented<Sex>
          value={stats.sex}
          onChange={v => onChange('sex', v)}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
        />
      </Field>

      <Field label="Age (years)">
        <Stepper value={stats.age} onChange={n => onChange('age', n)} min={10} max={100} />
      </Field>

      <Field label="Weight (kg)">
        <Stepper value={stats.weight} onChange={n => onChange('weight', n)} min={30} max={250} />
      </Field>

      <Field label="Height (cm)">
        <Stepper value={stats.height} onChange={n => onChange('height', n)} min={100} max={250} />
      </Field>

      <Field label="Activity level">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange('activityLevel', val)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                border: `1px solid ${stats.activityLevel === val ? 'rgba(124,58,237,0.5)' : T.border}`,
                background: stats.activityLevel === val ? 'rgba(124,58,237,0.08)' : T.surface,
                cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 99,
                border: `2px solid ${stats.activityLevel === val ? 'var(--mise-primary)' : T.muted}`,
                background: stats.activityLevel === val ? 'var(--mise-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {stats.activityLevel === val && (
                  <div style={{ width: 6, height: 6, borderRadius: 99, background: '#fff' }} />
                )}
              </div>
              <span style={{
                fontSize: 14, fontWeight: 500,
                color: stats.activityLevel === val ? 'var(--mise-primary)' : T.text,
              }}>{label}</span>
            </button>
          ))}
        </div>
      </Field>

      {/* Computed targets */}
      {goals && (
        <div style={{
          marginTop: 6, padding: '14px 16px',
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mise-primary)', marginBottom: 8, letterSpacing: 0.3 }}>
            YOUR DAILY TARGETS
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {goals.calories.toLocaleString()} kcal / day
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <MacroChip label="Protein" value={goals.protein} color="#F472B6" />
            <MacroChip label="Carbs"   value={goals.carbs}   color="#60A5FA" />
            <MacroChip label="Fat"     value={goals.fat}     color="#34D399" />
          </div>
        </div>
      )}
    </div>
  );
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 99,
      background: `${color}18`, border: `1px solid ${color}44`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{value}g</span>
      <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
    </div>
  );
}

function SavedPill({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 9px', borderRadius: 999,
      background: T.successTint, border: `1px solid ${T.successBord}`,
      color: T.success,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
    }}>
      <Check size={11} />{label}
    </div>
  );
}
