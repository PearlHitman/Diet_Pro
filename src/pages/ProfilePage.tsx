// Profile page. Auto-saves with a small debounce so the "Saved" pill
// settles after the user stops typing.

import React, { useEffect, useRef, useState } from 'react';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, Segmented, Stepper } from '../components/Forms';
import { T } from '../tokens';
import { Globe, Check } from '../components/Icons';
import { useApp } from '../lib/app-state';
import type { DietGoal, Language, Level, Profile } from '../lib/types';

export function ProfilePage() {
  const { profile, saveProfile, t } = useApp();
  const [local, setLocal] = useState<Profile>(profile);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Keep local in sync if profile changes externally (rare).
  useEffect(() => { setLocal(profile); }, [profile]);

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
            options={[{ value: 'EL', label: 'EL' }, { value: 'EN', label: 'EN' }]}
          />
        </div>
      </div>
    </Screen>
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
