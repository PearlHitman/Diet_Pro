// CameraImport — processes a photo or receipt file and lets the user
// review detected ingredients before saving.
//
// The file is captured upstream (PantryPage) so the camera/gallery picker
// is triggered directly from the user's tap — required for iOS permission.
//
// States: analyzing → review-single (photo) | review-bulk (receipt) | error

import React, { useEffect, useState } from 'react';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { scanProductPhoto, scanReceipt, type ScannedIngredient } from '../lib/claude';
import type { Category, Ingredient } from '../lib/types';

// ─── Types ───────────────────────────────────────────────────

export type CameraMode = 'photo' | 'receipt';

type Step =
  | { name: 'analyzing' }
  | { name: 'review-single'; item: Draft }
  | { name: 'review-bulk'; items: Draft[] }
  | { name: 'error'; message: string };

interface Draft extends ScannedIngredient {
  selected: boolean;
}

const CATS: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

// ─── Helpers ─────────────────────────────────────────────────

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg';
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makePantryItem(draft: Draft): Ingredient {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name.trim(),
    category: draft.category,
    expiresOn: null,
    amount: draft.amount?.trim() || undefined,
    addedAt: new Date().toISOString(),
  };
}

// ─── Component ───────────────────────────────────────────────

interface Props {
  file: File;
  mode: CameraMode;
  onClose: () => void;
}

export function CameraImport({ file, mode, onClose }: Props) {
  const { addIngredient, bulkAddIngredients, settings, profile, t } = useApp();
  const [step, setStep] = useState<Step>({ name: 'analyzing' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, mediaType } = await fileToBase64(file);

        if (mode === 'photo') {
          const result = await scanProductPhoto(data, mediaType, profile.language, settings);
          if (!cancelled) setStep({ name: 'review-single', item: { ...result, selected: true } });
        } else {
          const results = await scanReceipt(data, mediaType, profile.language, settings);
          if (cancelled) return;
          if (results.length === 0) {
            setStep({ name: 'error', message: t('nothingDetected') });
          } else {
            setStep({ name: 'review-bulk', items: results.map(r => ({ ...r, selected: true })) });
          }
        }
      } catch (e: any) {
        if (!cancelled) setStep({ name: 'error', message: e?.message ?? t('cameraError') });
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSingle(draft: Draft) {
    await addIngredient(makePantryItem(draft));
    onClose();
  }

  async function saveBulk(items: Draft[]) {
    const chosen = items.filter(i => i.selected);
    if (chosen.length > 0) await bulkAddIngredients(chosen.map(makePantryItem));
    onClose();
  }

  return (
    <Backdrop onClick={onClose}>
      <Sheet onClick={e => e.stopPropagation()}>
        {step.name === 'analyzing' && <AnalyzingView hint={t('analyzingPhoto')} />}

        {step.name === 'review-single' && (
          <ReviewSingleView
            item={step.item}
            onConfirm={saveSingle}
            onCancel={onClose}
            t={t}
          />
        )}

        {step.name === 'review-bulk' && (
          <ReviewBulkView
            items={step.items}
            onChange={items => setStep({ name: 'review-bulk', items })}
            onConfirm={saveBulk}
            onCancel={onClose}
            t={t}
          />
        )}

        {step.name === 'error' && (
          <ErrorView
            message={step.message}
            onClose={onClose}
            onRetry={onClose}
            t={t}
          />
        )}
      </Sheet>
    </Backdrop>
  );
}

// ─── Layout ───────────────────────────────────────────────────

function Backdrop({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      position: 'fixed', inset: 0, zIndex: 110,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      {children}
    </div>
  );
}

function Sheet({ onClick, children }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      width: '100%', maxWidth: 520,
      background: T.surface2,
      borderRadius: '20px 20px 0 0',
      border: `1px solid ${T.borderHi}`,
      borderBottom: 'none',
      maxHeight: '90dvh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

// ─── Analyzing ────────────────────────────────────────────────

function AnalyzingView({ hint }: { hint: string }) {
  return (
    <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: `3px solid ${T.accentTint}`,
        borderTopColor: T.accent,
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ fontSize: 14, color: T.text2 }}>{hint}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Review single ────────────────────────────────────────────

function ReviewSingleView({ item, onConfirm, onCancel, t }: {
  item: Draft;
  onConfirm: (d: Draft) => void;
  onCancel: () => void;
  t: (k: any, v?: any) => string;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount ?? '');
  const [category, setCategory] = useState<Category>(item.category);
  const { t: appT } = useApp();

  const catLabels: Record<Category, string> = {
    produce: appT('cat_produce'), protein: appT('cat_protein'),
    dairy: appT('cat_dairy'), grains: appT('cat_grains'),
    pantry: appT('cat_pantry'), other: appT('cat_other'),
  };

  return (
    <div style={{ padding: '20px 20px 28px', overflowY: 'auto' }}>
      <SheetHeader title={t('confirmIngredient')} onClose={onCancel} />

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>{t('name')}</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('amountOpt')}</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('amountPlaceholder')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('category')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATS.map(c => (
              <button key={c} type="button" onClick={() => setCategory(c)} style={{
                padding: '7px 12px', borderRadius: 999,
                background: category === c ? T.accentTint : T.surface,
                border: `1px solid ${category === c ? T.borderAcc : T.border}`,
                color: category === c ? T.accent : T.text2,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
              }}>{catLabels[c]}</button>
            ))}
          </div>
        </div>
      </div>

      <button
        disabled={!name.trim()}
        onClick={() => onConfirm({ name, amount: amount || undefined, category, selected: true })}
        style={{
          marginTop: 22, width: '100%', padding: '14px', borderRadius: 14, border: 'none',
          background: name.trim() ? T.accentGrad : T.surface,
          color: name.trim() ? '#1a1208' : T.muted,
          fontSize: 15, fontWeight: 700,
          cursor: name.trim() ? 'pointer' : 'not-allowed',
          fontFamily: T.font,
        }}
      >{t('addToPantry')}</button>
    </div>
  );
}

// ─── Review bulk ──────────────────────────────────────────────

function ReviewBulkView({ items, onChange, onConfirm, onCancel, t }: {
  items: Draft[];
  onChange: (items: Draft[]) => void;
  onConfirm: (items: Draft[]) => void;
  onCancel: () => void;
  t: (k: any, v?: any) => string;
}) {
  const selected = items.filter(i => i.selected).length;
  const allSelected = selected === items.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <SheetHeader title={t('foundNIngredients').replace('{n}', String(items.length))} onClose={onCancel} />
        <button onClick={() => onChange(items.map(i => ({ ...i, selected: !allSelected })))} style={{
          marginTop: 12, padding: '6px 14px', borderRadius: 999,
          border: `1px solid ${T.border}`, background: T.surface,
          color: T.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
        }}>
          {allSelected ? t('deselectAll') : t('selectAll')}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, idx) => (
            <button key={idx} onClick={() => onChange(items.map((x, i) => i === idx ? { ...x, selected: !x.selected } : x))} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 12,
              background: it.selected ? T.accentTint : T.surface,
              border: `1px solid ${it.selected ? T.borderAcc : T.border}`,
              cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${it.selected ? T.accent : T.mute2}`,
                background: it.selected ? T.accent : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {it.selected && <span style={{ fontSize: 11, color: '#1a1208', fontWeight: 900 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{it.name}</div>
                {it.amount && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{it.amount}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 20px 28px', flexShrink: 0, borderTop: `1px solid ${T.border}` }}>
        <button
          disabled={selected === 0}
          onClick={() => onConfirm(items)}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: selected > 0 ? T.accentGrad : T.surface,
            color: selected > 0 ? '#1a1208' : T.muted,
            fontSize: 15, fontWeight: 700,
            cursor: selected > 0 ? 'pointer' : 'not-allowed',
            fontFamily: T.font,
          }}
        >{t('importNItems').replace('{n}', String(selected))}</button>
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────

function ErrorView({ message, onClose, onRetry, t }: {
  message: string; onClose: () => void; onRetry: () => void;
  t: (k: any) => string;
}) {
  return (
    <div style={{ padding: '32px 20px 28px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>{t('errorTitle')}</div>
      <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, marginBottom: 24 }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, background: T.surface, color: T.text2, border: `1px solid ${T.border}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: T.font }}>{t('cancel')}</button>
        <button onClick={onRetry} style={{ flex: 1, padding: '12px', borderRadius: 12, background: T.accentGrad, color: '#1a1208', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: T.font }}>{t('retry')}</button>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{title}</div>
      <button onClick={onClose} style={{
        width: 30, height: 30, borderRadius: 999,
        border: 'none', background: T.surface, color: T.text2,
        cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.font,
      }}>✕</button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: T.text2,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: T.surface, border: `1px solid ${T.border}`,
  color: T.text, fontSize: 14, fontFamily: T.font,
  outline: 'none', boxSizing: 'border-box',
};
