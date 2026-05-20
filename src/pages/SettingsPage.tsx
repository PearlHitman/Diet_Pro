// Settings — API key (BYOK), model, theme, data portability, danger zone.

import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, Segmented, PrimaryButton, GhostButton } from '../components/Forms';
import { Check, X, AlertCircle, Trash } from '../components/Icons';
import { useApp } from '../lib/app-state';
import { validateApiKey } from '../lib/claude';
import { t as translate } from '../lib/i18n';
import type { ClaudeModel, RecipeSpeed, ThemePref } from '../lib/types';

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
  // Revoke a tick later so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const { settings, saveSettings, profile, saveProfile, resetAll, exportData, importData, t } = useApp();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [model, setModel] = useState<ClaudeModel>(settings.model);
  const [recipeSpeed, setRecipeSpeed] = useState<RecipeSpeed>(settings.recipeSpeed ?? 'best');
  const [keyState, setKeyState] = useState<KeyState>(settings.apiKey ? 'valid' : 'unchecked');
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveKey() {
    setKeyState('checking');
    setValidationError('');
    const result = await validateApiKey(keyDraft);
    if (result.ok) {
      setKeyState('valid');
      await saveSettings({ ...settings, apiKey: keyDraft, model, recipeSpeed });
    } else {
      setKeyState('invalid');
      setValidationError(result.reason);
    }
  }

  async function handleModelChange(m: ClaudeModel) {
    setModel(m);
    await saveSettings({ ...settings, model: m, recipeSpeed });
  }

  async function handleRecipeSpeedChange(speed: RecipeSpeed) {
    setRecipeSpeed(speed);
    await saveSettings({ ...settings, recipeSpeed: speed, model });
  }

  async function handleThemeChange(theme: ThemePref) {
    // Persist on the user's profile; the AppProvider re-applies the
    // data-theme attribute via its effect.
    await saveProfile({ ...profile, theme });
  }

  async function handleReset() {
    if (window.confirm(t('resetConfirm'))) {
      await resetAll();
      setKeyDraft('');
      setKeyState('unchecked');
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
    // Reset the input so the same file can be re-selected later.
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
        {/* API key */}
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
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--mise-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--mise-font-text)',
                }}
              >
                <AlertCircle size={13} color="var(--mise-error)" />
                {validationError}
              </div>
            )}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--mise-primary)',
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              → {t('getApiKey')}
            </a>
          </div>
        </Field>

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

        {/* Danger zone */}
        <div style={{ marginTop: 40 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: 'var(--mise-error)',
              marginBottom: 12,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            Danger zone
          </div>
          <GhostButton onClick={handleReset} icon={<Trash size={14} color="var(--mise-error)" />} fullWidth>
            <span style={{ color: 'var(--mise-error)' }}>{t('resetAll')}</span>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '7px 12px',
          borderRadius: 999,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: 'var(--mise-success)',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--mise-font-text)',
        }}
      >
        <Check size={12} />
        {t('apiKeyValid')}
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 12px',
        borderRadius: 999,
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        color: 'var(--mise-error)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--mise-font-text)',
      }}
    >
      <X size={12} />
      {t('apiKeyInvalid')}
    </div>
  );
}
