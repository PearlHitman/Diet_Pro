// Settings -- API key (BYOK), model, theme, data portability, danger zone.

import React, { useRef, useState } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { toast } from 'sonner';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, Segmented, PrimaryButton, GhostButton } from '../components/Forms';
import { Check, X, AlertCircle, Trash } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { validateApiKey } from '../lib/claude';
import { t as translate } from '../lib/i18n';
import { MEAL_COLORS, applyPrimaryToRoot } from '../lib/mealtime';
import type { ClaudeModel, RecipeSpeed, ThemePref, TonePref } from '../lib/types';

type KeyState = 'unchecked' | 'checking' | 'valid' | 'invalid';

type TKey = Parameters<typeof translate>[1];

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const { settings, saveSettings, profile, saveProfile, resetAll, exportData, importData, t } = useApp();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [model, setModel] = useState<ClaudeModel>(settings.model);
  const [recipeSpeed, setRecipeSpeed] = useState<RecipeSpeed>(settings.recipeSpeed ?? 'best');
  const [keyState, setKeyState] = useState<KeyState>(settings.apiKey ? 'valid' : 'unchecked');
  const [validationError, setValidationError] = useState('');
  const [byok, setByok] = useState(settings.byok ?? false);
  const [autoColor, setAutoColor] = useState(profile.autoColor !== false);
  const [tone, setTone] = useState<TonePref>(profile.tone ?? 'warm-dark');
  const [manualColor, setManualColor] = useState(profile.manualColor ?? MEAL_COLORS.orange);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleByokChange(checked: boolean) {
    setByok(checked);
    await saveSettings({ ...settings, byok: checked, model, recipeSpeed });
  }

  async function handleSaveKey() {
    setKeyState('checking');
    setValidationError('');
    const result = await validateApiKey(keyDraft);
    if (result.ok) {
      setKeyState('valid');
      await saveSettings({ ...settings, apiKey: keyDraft, model, recipeSpeed, byok });
    } else {
      setKeyState('invalid');
      setValidationError(result.reason);
    }
  }

  async function handleModelChange(m: ClaudeModel) {
    setModel(m);
    await saveSettings({ ...settings, model: m, recipeSpeed, byok });
  }

  async function handleRecipeSpeedChange(speed: RecipeSpeed) {
    setRecipeSpeed(speed);
    await saveSettings({ ...settings, recipeSpeed: speed, model, byok });
  }

  async function handleThemeChange(theme: ThemePref) {
    await saveProfile({ ...profile, theme });
  }

  async function handleAutoColorChange(checked: boolean) {
    setAutoColor(checked);
    await saveProfile({ ...profile, autoColor: checked, tone, manualColor });
  }

  async function handleToneChange(newTone: TonePref) {
    setTone(newTone);
    await saveProfile({ ...profile, tone: newTone, autoColor, manualColor });
  }

  async function handleManualColorChange(color: string) {
    setManualColor(color);
    applyPrimaryToRoot(color);
    await saveProfile({ ...profile, manualColor: color, autoColor: false, tone });
  }

  async function handleReset() {
    if (window.confirm(t('resetConfirm'))) {
      await resetAll();
      setKeyDraft('');
      setKeyState('unchecked');
      setByok(false);
    }
  }

  async function handleExport() {
    try {
      const payload = await exportData();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`mise-export-${stamp}.json`, payload);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      toast.error(t('importFailed', { reason }));
    }
  }

  function handleImportClick() {
    if (!window.confirm(t('importConfirm'))) return;
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importData(parsed);
      toast.success(t('importSuccess'));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      toast.error(t('importFailed', { reason }));
    }
  }

  return (
    <Screen>
      <SubHeader title={t('settings')} />

      <div style={{ padding: '20px 20px 28px' }}>

        {/* Appearance */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: T.fontSize.small, fontWeight: 600, letterSpacing: '0.12em',
            color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
            fontFamily: 'var(--font-sans)',
          }}>
            Appearance
          </div>

          {/* Time-of-day colour toggle */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, marginBottom: 20,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fontSize.body, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>
                Time of day colour
              </div>
              <div style={{ fontSize: T.fontSize.caption, color: 'var(--text-3)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
                Primary colour shifts from yellow (breakfast) to green (lunch) to orange (dinner)
              </div>
            </div>
            <SwitchPrimitive.Root
              checked={autoColor}
              onCheckedChange={handleAutoColorChange}
              style={{
                flexShrink: 0, width: 44, height: 24, borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: autoColor ? 'var(--primary)' : 'rgba(120,120,128,0.32)',
                position: 'relative', transition: 'background 200ms',
                outline: 'none',
              }}
            >
              <SwitchPrimitive.Thumb style={{
                display: 'block', width: 20, height: 20, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                position: 'absolute', top: 2, left: 2,
                transition: 'transform 150ms',
                transform: autoColor ? 'translateX(20px)' : 'translateX(0)',
                willChange: 'transform',
              }} />
            </SwitchPrimitive.Root>
          </div>

          {/* Manual colour swatches when auto is off */}
          {!autoColor && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {([
                { label: 'Breakfast', color: MEAL_COLORS.yellow },
                { label: 'Lunch',     color: MEAL_COLORS.green  },
                { label: 'Dinner',    color: MEAL_COLORS.orange },
              ] as const).map(({ label, color }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleManualColorChange(color)}
                  title={label}
                  style={{
                    flex: 1, height: 36, borderRadius: 10,
                    background: color,
                    border: manualColor === color
                      ? '2px solid var(--text)'
                      : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: manualColor === color ? `0 0 0 2px ${color}55` : 'none',
                    transition: 'border-color 140ms, box-shadow 140ms',
                  }}
                  aria-label={`Set colour to ${label}`}
                />
              ))}
            </div>
          )}

          {/* Tone picker */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: T.fontSize.small, fontWeight: 500, color: 'var(--text-2)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
              Tone
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { value: 'warm-dark',       label: 'Warm dark',       bg: '#0c0a09', surface: '#16120f' },
                { value: 'slate-dark',      label: 'Slate dark',      bg: '#0a0e10', surface: '#0f1518' },
                { value: 'espresso',        label: 'Espresso',        bg: '#100806', surface: '#1a0e0a' },
                { value: 'editorial-cream', label: 'Editorial cream', bg: '#f7f3ec', surface: '#ffffff' },
              ] as const).map(({ value, label, bg, surface }) => {
                const active = tone === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleToneChange(value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'var(--primary-dim)' : 'var(--surface-2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, border: `1px solid ${surface}44`, flexShrink: 0 }} />
                    <span style={{ fontSize: T.fontSize.small, fontWeight: 500, color: active ? 'var(--primary)' : 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* API key -- only visible in BYOK/developer mode */}
        {byok && (
          <Field label={t('apiKey')} hint={t('apiKeyHint')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                value={keyDraft}
                onChange={v => { setKeyDraft(v); setKeyState('unchecked'); }}
                placeholder={t('apiKeyPlaceholder')}
                type="password"
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <PrimaryButton
                  onClick={handleSaveKey}
                  disabled={!keyDraft || keyState === 'checking'}
                >
                  {keyState === 'checking' ? t('validating') : t('testKey')}
                </PrimaryButton>
                <KeyStatusBadge state={keyState} t={t} />
              </div>
              {validationError && (
                <div style={{
                  fontSize: T.fontSize.small,
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-sans)',
                }}>
                  <AlertCircle size={13} color="var(--danger)" />
                  {validationError}
                </div>
              )}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--primary)',
                  fontSize: T.fontSize.small,
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                {t('getApiKey')}
              </a>
            </div>
          </Field>
        )}

        {/* Recipe generation speed */}
        <Field label={t('recipeSpeed')} hint={t('recipeSpeedHint')}>
          <Segmented<RecipeSpeed>
            value={recipeSpeed}
            onChange={handleRecipeSpeedChange}
            options={[
              { value: 'fast', label: t('recipeSpeedFast') },
              { value: 'best', label: t('recipeSpeedBest') },
            ]}
          />
        </Field>

        {/* Model */}
        <Field label={t('model')} hint={t('modelHint')}>
          <Segmented<ClaudeModel>
            value={model}
            onChange={handleModelChange}
            options={[
              { value: 'claude-haiku-4-5', label: 'Haiku' },
              { value: 'claude-sonnet-4-5', label: 'Sonnet' },
              { value: 'claude-opus-4-5', label: 'Opus' },
            ]}
          />
        </Field>

        {/* Theme */}
        <Field label={t('theme')} hint={t('themeHint')}>
          <Segmented<ThemePref>
            value={profile.theme}
            onChange={handleThemeChange}
            options={[
              { value: 'system', label: t('themeSystem') },
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
            ]}
          />
        </Field>

        {/* Data portability */}
        <Field label={t('exportData')} hint={t('exportDataHint')}>
          <GhostButton onClick={handleExport} fullWidth>
            {t('exportData')}
          </GhostButton>
        </Field>

        <Field label={t('importData')} hint={t('importDataHint')}>
          <GhostButton onClick={handleImportClick} fullWidth>
            {t('importData')}
          </GhostButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </Field>

        {/* Developer section */}
        <div style={{ marginTop: 40 }}>
          <div style={{
            fontSize: T.fontSize.small,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--text-3)',
            marginBottom: 16,
            fontFamily: 'var(--font-sans)',
          }}>
            {t('developerSection')}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: T.fontSize.body,
                fontWeight: 500,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                marginBottom: 4,
              }}>
                {t('byokToggle')}
              </div>
              <div style={{
                fontSize: T.fontSize.caption,
                color: 'var(--text-3)',
                lineHeight: 1.5,
                fontFamily: 'var(--font-sans)',
              }}>
                {t('byokToggleHint')}
              </div>
            </div>
            <SwitchPrimitive.Root
              checked={byok}
              onCheckedChange={handleByokChange}
              style={{
                flexShrink: 0,
                width: 44,
                height: 24,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: byok ? 'var(--primary)' : 'rgba(120,120,128,0.32)',
                position: 'relative',
                transition: 'background 150ms',
                outline: 'none',
              }}
            >
              <SwitchPrimitive.Thumb style={{
                display: 'block',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                position: 'absolute',
                top: 2,
                left: 2,
                transition: 'transform 150ms',
                transform: byok ? 'translateX(20px)' : 'translateX(0)',
                willChange: 'transform',
              }} />
            </SwitchPrimitive.Root>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ marginTop: 40 }}>
          <div style={{
            fontSize: T.fontSize.small,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: 'var(--danger)',
            marginBottom: 12,
            fontFamily: 'var(--font-sans)',
          }}>
            Danger zone
          </div>
          <GhostButton onClick={handleReset} icon={<Trash size={14} color="var(--danger)" />} fullWidth>
            <span style={{ color: 'var(--danger)' }}>{t('resetAll')}</span>
          </GhostButton>
        </div>
      </div>
    </Screen>
  );
}

function KeyStatusBadge({ state, t }: { state: KeyState; t: (k: TKey, v?: Record<string, string | number>) => string }) {
  if (state === 'unchecked' || state === 'checking') return null;
  if (state === 'valid') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 12px',
        borderRadius: 999,
        background: 'rgba(16, 185, 129, 0.12)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        color: 'var(--success)',
        fontSize: T.fontSize.caption,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
      }}>
        <Check size={12} />
        {t('apiKeyValid')}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '7px 12px',
      borderRadius: 999,
      background: 'rgba(239, 68, 68, 0.12)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      color: 'var(--danger)',
      fontSize: T.fontSize.caption,
      fontWeight: 600,
      fontFamily: 'var(--font-sans)',
    }}>
      <X size={12} />
      {t('apiKeyInvalid')}
    </div>
  );
}
