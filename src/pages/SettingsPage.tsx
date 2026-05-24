// Settings -- API key (BYOK), model, theme, data portability, danger zone.

import React, { useEffect, useRef, useState } from 'react';
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
import { redeemPromoCode, getPromoStatus } from '../lib/backend';
import type { ClaudeModel, RecipeSpeed, ThemePref, TonePref, PromoStatus } from '../lib/types';

type KeyState = 'unchecked' | 'checking' | 'valid' | 'invalid';
type PromoInputState = 'idle' | 'checking' | 'success' | 'error';

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

  // Promo state
  const [promoCode, setPromoCode]             = useState('');
  const [promoInputState, setPromoInputState] = useState<PromoInputState>('idle');
  const [promoError, setPromoError]           = useState('');
  const [promoStatus, setPromoStatus]         = useState<PromoStatus | null>(null);

  useEffect(() => {
    getPromoStatus().then(setPromoStatus).catch(() => {});
  }, []);

  async function handleRedeemPromo() {
    if (!promoCode.trim()) return;
    setPromoInputState('checking');
    setPromoError('');
    try {
      await redeemPromoCode(promoCode.trim());
      setPromoInputState('success');
      setPromoCode('');
      const fresh = await getPromoStatus();
      setPromoStatus(fresh);
      toast.success('Promo activated! Enjoy your extended access.');
    } catch (e) {
      setPromoInputState('error');
      setPromoError(e instanceof Error ? e.message : 'Invalid code');
    }
  }

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

        {/* Promo */}
        <PromoSection
          promoStatus={promoStatus}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          promoInputState={promoInputState}
          promoError={promoError}
          onRedeem={handleRedeemPromo}
        />

        {/* Appearance */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: T.fontSize.small, fontWeight: 600, letterSpacing: '0.12em',
            color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
            fontFamily: 'var(--font-sans)',
          }}>
            Appearance
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
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
                position: 'relative', transition: 'background 200ms', outline: 'none',
              }}
            >
              <SwitchPrimitive.Thumb style={{
                display: 'block', width: 20, height: 20, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                position: 'absolute', top: 2, left: 2, transition: 'transform 150ms',
                transform: autoColor ? 'translateX(20px)' : 'translateX(0)',
                willChange: 'transform',
              }} />
            </SwitchPrimitive.Root>
          </div>

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
                    flex: 1, height: 36, borderRadius: 10, background: color,
                    border: manualColor === color ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: manualColor === color ? `0 0 0 2px ${color}55` : 'none',
                    transition: 'border-color 140ms, box-shadow 140ms',
                  }}
                  aria-label={`Set colour to ${label}`}
                />
              ))}
            </div>
          )}

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
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      background: active ? 'var(--primary-dim)' : 'var(--surface-2)',
                      cursor: 'pointer', textAlign: 'left',
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
                <PrimaryButton onClick={handleSaveKey} disabled={!keyDraft || keyState === 'checking'}>
                  {keyState === 'checking' ? t('validating') : t('testKey')}
                </PrimaryButton>
                <KeyStatusBadge state={keyState} t={t} />
              </div>
              {validationError && (
                <div style={{ fontSize: T.fontSize.small, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
                  <AlertCircle size={13} color="var(--danger)" />
                  {validationError}
                </div>
              )}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
                style={{ color: 'var(--primary)', fontSize: T.fontSize.small, textDecoration: 'none', fontWeight: 500 }}>
                {t('getApiKey')}
              </a>
            </div>
          </Field>
        )}

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

        <Field label={t('exportData')} hint={t('exportDataHint')}>
          <GhostButton onClick={handleExport} fullWidth>{t('exportData')}</GhostButton>
        </Field>

        <Field label={t('importData')} hint={t('importDataHint')}>
          <GhostButton onClick={handleImportClick} fullWidth>{t('importData')}</GhostButton>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
        </Field>

        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: T.fontSize.small, fontWeight: 600, letterSpacing: 0.4, color: 'var(--text-3)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
            {t('developerSection')}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.fontSize.body, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
                {t('byokToggle')}
              </div>
              <div style={{ fontSize: T.fontSize.caption, color: 'var(--text-3)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
                {t('byokToggleHint')}
              </div>
            </div>
            <SwitchPrimitive.Root
              checked={byok}
              onCheckedChange={handleByokChange}
              style={{
                flexShrink: 0, width: 44, height: 24, borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: byok ? 'var(--primary)' : 'rgba(120,120,128,0.32)',
                position: 'relative', transition: 'background 150ms', outline: 'none',
              }}
            >
              <SwitchPrimitive.Thumb style={{
                display: 'block', width: 20, height: 20, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                position: 'absolute', top: 2, left: 2, transition: 'transform 150ms',
                transform: byok ? 'translateX(20px)' : 'translateX(0)',
                willChange: 'transform',
              }} />
            </SwitchPrimitive.Root>
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: T.fontSize.small, fontWeight: 600, letterSpacing: 0.4, color: 'var(--danger)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
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

// =============================================================================
// PromoSection
// =============================================================================

interface PromoSectionProps {
  promoStatus: PromoStatus | null;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoInputState: PromoInputState;
  promoError: string;
  onRedeem: () => void;
}

function PromoSection({ promoStatus, promoCode, setPromoCode, promoInputState, promoError, onRedeem }: PromoSectionProps) {
  const sectionLabel = (
    <div style={{
      fontSize: T.fontSize.small, fontWeight: 600, letterSpacing: '0.12em',
      color: 'var(--text-3)', textTransform: 'uppercase' as const, marginBottom: 14,
      fontFamily: 'var(--font-sans)',
    }}>
      Promo
    </div>
  );

  // Grace period -- days 0-4: unlimited
  if (promoStatus?.active && promoStatus.inGracePeriod) {
    const graceDaysLeft = promoStatus.gracePeriodEnds
      ? Math.max(0, Math.ceil((new Date(promoStatus.gracePeriodEnds).getTime() - Date.now()) / 86400000))
      : 5;
    return (
      <div style={{ marginBottom: 32 }}>
        {sectionLabel}
        <PromoCard variant="grace">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>&#x2728;</span>
            <span style={{ fontSize: T.fontSize.body, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)' }}>
              Unlimited access
            </span>
          </div>
          <div style={{ fontSize: T.fontSize.small, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
            Free grace period active &mdash; no daily limits.{' '}
            <strong style={{ color: '#fff' }}>{graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''}</strong>{' '}
            until the 20 scans/day window begins.
          </div>
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '4px 10px' }}>
            <span style={{ fontSize: T.fontSize.caption, color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              Code: {promoStatus.code}
            </span>
          </div>
        </PromoCard>
      </div>
    );
  }

  // Active promo window -- days 5-90: 20/day
  if (promoStatus?.active && !promoStatus.inGracePeriod) {
    const total     = 90;
    const remaining = promoStatus.daysRemaining ?? 0;
    const used      = total - remaining;
    const pct       = Math.min(100, Math.round((used / total) * 100));
    const expiryStr = promoStatus.expiresAt
      ? new Date(promoStatus.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return (
      <div style={{ marginBottom: 32 }}>
        {sectionLabel}
        <PromoCard variant="active">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>&#x1F39F;</span>
              <span style={{ fontSize: T.fontSize.body, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Promo active
              </span>
            </div>
            <div style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary)', borderRadius: 999, padding: '3px 10px', fontSize: T.fontSize.caption, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-sans)' }}>
              {remaining}d left
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <StatPill label="Daily limit" value="20 scans" />
            <StatPill label="Expires" value={expiryStr || '—'} />
          </div>
          <div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(120,120,128,0.18)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 999, transition: 'width 600ms ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: T.fontSize.caption, color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
              <span>Day {used}</span>
              <span>90 days</span>
            </div>
          </div>
        </PromoCard>
      </div>
    );
  }

  // Expired
  if (promoStatus && !promoStatus.active && promoStatus.code) {
    return (
      <div style={{ marginBottom: 32 }}>
        {sectionLabel}
        <div style={{ borderRadius: 16, border: '1.5px dashed var(--border)', padding: '16px 18px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>&#x23F0;</span>
          <div>
            <div style={{ fontSize: T.fontSize.small, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>Your promo has expired</div>
            <div style={{ fontSize: T.fontSize.caption, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>Back to 3 scans/day. Have another code? Enter it below.</div>
          </div>
        </div>
        <PromoInput promoCode={promoCode} setPromoCode={setPromoCode} promoInputState={promoInputState} promoError={promoError} onRedeem={onRedeem} />
      </div>
    );
  }

  // No code -- entry form
  return (
    <div style={{ marginBottom: 32 }}>
      {sectionLabel}
      <div style={{ borderRadius: 16, border: '1.5px dashed var(--border)', padding: '18px', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>&#x1F381;</span>
          <div>
            <div style={{ fontSize: T.fontSize.small, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Have a promo code?</div>
            <div style={{ fontSize: T.fontSize.caption, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', marginTop: 2, lineHeight: 1.5 }}>
              Unlock 90 days of extended access &mdash; 20 scans/day after a 5-day grace period.
            </div>
          </div>
        </div>
        <PromoInput promoCode={promoCode} setPromoCode={setPromoCode} promoInputState={promoInputState} promoError={promoError} onRedeem={onRedeem} />
      </div>
    </div>
  );
}

function PromoCard({ children, variant }: { children: React.ReactNode; variant: 'grace' | 'active' }) {
  const isGrace = variant === 'grace';
  return (
    <div style={{
      borderRadius: 18, padding: '18px 20px',
      background: isGrace ? 'linear-gradient(135deg, #b45309 0%, #d97706 60%, #f59e0b 100%)' : 'var(--surface-2)',
      border: isGrace ? 'none' : '1.5px solid var(--border)',
      boxShadow: isGrace ? '0 4px 24px rgba(180,83,9,0.35)' : '0 1px 8px rgba(0,0,0,0.08)',
      position: 'relative' as const, overflow: 'hidden' as const,
    }}>
      {isGrace && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)' }} />
      )}
      {children}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(120,120,128,0.1)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: T.fontSize.small, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        {value}
      </div>
    </div>
  );
}

interface PromoInputProps {
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoInputState: PromoInputState;
  promoError: string;
  onRedeem: () => void;
  style?: React.CSSProperties;
}

function PromoInput({ promoCode, setPromoCode, promoInputState, promoError, onRedeem, style }: PromoInputProps) {
  const isChecking = promoInputState === 'checking';
  return (
    <div style={style}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); }}
            onKeyDown={e => { if (e.key === 'Enter') onRedeem(); }}
            placeholder="ENTER CODE"
            disabled={isChecking}
            style={{
              width: '100%', boxSizing: 'border-box' as const, padding: '10px 14px',
              background: 'var(--surface)',
              border: `1.5px solid ${promoInputState === 'error' ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 12, color: 'var(--text)', fontSize: T.fontSize.small,
              fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.12em',
              fontWeight: 600, outline: 'none', transition: 'border-color 150ms',
            }}
          />
        </div>
        <button
          onClick={onRedeem}
          disabled={!promoCode.trim() || isChecking}
          style={{
            flexShrink: 0, padding: '10px 18px', borderRadius: 12, border: 'none',
            background: (!promoCode.trim() || isChecking) ? 'rgba(120,120,128,0.18)' : 'var(--primary)',
            color: (!promoCode.trim() || isChecking) ? 'var(--text-3)' : '#fff',
            fontSize: T.fontSize.small, fontWeight: 700, fontFamily: 'var(--font-sans)',
            cursor: (!promoCode.trim() || isChecking) ? 'not-allowed' : 'pointer',
            transition: 'background 150ms, color 150ms', whiteSpace: 'nowrap' as const,
          }}
        >
          {isChecking ? '...' : 'Apply'}
        </button>
      </div>
      {promoInputState === 'error' && promoError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: T.fontSize.caption, color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
          <AlertCircle size={12} color="var(--danger)" />
          {promoError}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// KeyStatusBadge
// =============================================================================

function KeyStatusBadge({ state, t }: { state: KeyState; t: (k: TKey, v?: Record<string, string | number>) => string }) {
  if (state === 'unchecked' || state === 'checking') return null;
  if (state === 'valid') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)', fontSize: T.fontSize.caption, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
        <Check size={12} />
        {t('apiKeyValid')}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', fontSize: T.fontSize.caption, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
      <X size={12} />
      {t('apiKeyInvalid')}
    </div>
  );
}
