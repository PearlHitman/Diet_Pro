// Settings page — API key entry (BYOK), model selection, danger zone.
// Key is validated against Anthropic before being marked OK.

import React, { useState } from 'react';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, Segmented, PrimaryButton, GhostButton } from '../components/Forms';
import { T } from '../tokens';
import { Check, X, AlertCircle, Trash } from '../components/Icons';
import { useApp } from '../lib/app-state';
import { validateApiKey } from '../lib/claude';
import type { ClaudeModel } from '../lib/types';

type KeyState = 'unchecked' | 'checking' | 'valid' | 'invalid';

export function SettingsPage() {
  const { settings, saveSettings, resetAll, t } = useApp();
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [model, setModel] = useState<ClaudeModel>(settings.model);
  const [keyState, setKeyState] = useState<KeyState>(settings.apiKey ? 'valid' : 'unchecked');
  const [validationError, setValidationError] = useState('');

  async function handleSaveKey() {
    setKeyState('checking');
    setValidationError('');
    const result = await validateApiKey(keyDraft);
    if (result.ok) {
      setKeyState('valid');
      await saveSettings({ ...settings, apiKey: keyDraft, model });
    } else {
      setKeyState('invalid');
      setValidationError(result.reason);
    }
  }

  async function handleModelChange(m: ClaudeModel) {
    setModel(m);
    await saveSettings({ ...settings, model: m });
  }

  async function handleReset() {
    if (window.confirm(t('resetConfirm'))) {
      await resetAll();
      setKeyDraft('');
      setKeyState('unchecked');
    }
  }

  return (
    <Screen>
      <SubHeader title={t('settings')} />

      <div style={{ padding: '16px 20px 28px' }}>
        {/* API key */}
        <Field label={t('apiKey')} hint={t('apiKeyHint')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input
              value={keyDraft}
              onChange={v => { setKeyDraft(v); setKeyState('unchecked'); }}
              placeholder={t('apiKeyPlaceholder')}
              type="password"
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                fontSize: 12, color: T.danger,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertCircle size={13} color={T.danger} />
                {validationError}
              </div>
            )}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: T.accent, fontSize: 12, textDecoration: 'none' }}
            >→ {t('getApiKey')}</a>
          </div>
        </Field>

        {/* Model */}
        <Field label={t('model')} hint={t('modelHint')}>
          <Segmented<ClaudeModel>
            value={model}
            onChange={handleModelChange}
            options={[
              { value: 'claude-haiku-4-5',  label: 'Haiku' },
              { value: 'claude-sonnet-4-5', label: 'Sonnet' },
              { value: 'claude-opus-4-7',   label: 'Opus' },
            ]}
          />
        </Field>

        {/* Danger zone */}
        <div style={{ marginTop: 40 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
            textTransform: 'uppercase', color: T.danger, marginBottom: 10,
          }}>Danger zone</div>
          <GhostButton onClick={handleReset} icon={<Trash size={14} color={T.danger} />} fullWidth>
            <span style={{ color: T.danger }}>{t('resetAll')}</span>
          </GhostButton>
        </div>
      </div>
    </Screen>
  );
}

function KeyStatusBadge({ state, t }: { state: KeyState; t: (k: any) => string }) {
  if (state === 'unchecked') return null;
  if (state === 'checking') return null;
  if (state === 'valid') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px', borderRadius: 999,
        background: T.successTint, border: `1px solid ${T.successBord}`,
        color: T.success, fontSize: 11, fontWeight: 600,
      }}>
        <Check size={12} />{t('apiKeyValid')}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderRadius: 999,
      background: T.dangerTint, border: `1px solid rgba(248,113,113,0.3)`,
      color: T.danger, fontSize: 11, fontWeight: 600,
    }}>
      <X size={12} />{t('apiKeyInvalid')}
    </div>
  );
}
