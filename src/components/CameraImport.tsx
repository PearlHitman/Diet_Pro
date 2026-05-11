// CameraImport — three-mode camera-based pantry import.
//
// Modes:
//   picker        → bottom sheet: choose barcode / product photo / receipt
//   barcode       → live camera viewfinder with html5-qrcode
//   analyzing     → spinner while Claude processes a photo
//   review-single → confirm / edit one ingredient before saving
//   review-bulk   → toggle list of receipt ingredients before bulk save
//   error         → error message with retry / close

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import { scanProductPhoto, scanReceipt, type ScannedIngredient } from '../lib/claude';
import type { Category, Ingredient } from '../lib/types';

// ─── Types ───────────────────────────────────────────────────

type Step =
  | { name: 'picker' }
  | { name: 'barcode' }
  | { name: 'barcode-not-found' }
  | { name: 'analyzing'; hint: string }
  | { name: 'review-single'; item: DraftIngredient }
  | { name: 'review-bulk'; items: DraftIngredient[] }
  | { name: 'error'; message: string };

interface DraftIngredient extends ScannedIngredient {
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

function makeIngredient(draft: DraftIngredient): Ingredient {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name.trim(),
    category: draft.category,
    expiresOn: null,
    amount: draft.amount?.trim() || undefined,
    addedAt: new Date().toISOString(),
  };
}

// ─── Open Food Facts lookup ───────────────────────────────────

async function lookupBarcode(barcode: string): Promise<ScannedIngredient | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_pl,quantity`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1) return null;
    const p = json.product;
    const rawName: string = p.product_name_pl || p.product_name || '';
    if (!rawName.trim()) return null;
    // Use the raw product name — user can edit before saving.
    return { name: rawName.trim(), amount: p.quantity || undefined, category: 'pantry' };
  } catch {
    return null;
  }
}

// ─── Main component ───────────────────────────────────────────

export function CameraImport({ onClose }: { onClose: () => void }) {
  const { addIngredient, bulkAddIngredients, settings, profile, t } = useApp();
  const [step, setStep] = useState<Step>({ name: 'picker' });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // BarcodeScanner sub-component needs a stable ID for the div it mounts into.
  const scannerId = useId().replace(/:/g, '_');

  // ─── Barcode flow ──────────────────────────────────────────

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    setStep({ name: 'analyzing', hint: t('analyzingPhoto') });
    const found = await lookupBarcode(barcode);
    if (found) {
      setStep({ name: 'review-single', item: { ...found, selected: true } });
    } else {
      setStep({ name: 'barcode-not-found' });
      setTimeout(() => {
        // Auto-switch to product photo mode.
        photoInputRef.current?.click();
        setStep({ name: 'picker' });
      }, 2000);
    }
  }, [t]);

  // ─── Photo / receipt flow ──────────────────────────────────

  async function handlePhotoFile(file: File) {
    setStep({ name: 'analyzing', hint: t('analyzingPhoto') });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const result = await scanProductPhoto(data, mediaType, profile.language, settings);
      setStep({ name: 'review-single', item: { ...result, selected: true } });
    } catch (e: any) {
      setStep({ name: 'error', message: e?.message ?? t('cameraError') });
    }
  }

  async function handleReceiptFile(file: File) {
    setStep({ name: 'analyzing', hint: t('analyzingPhoto') });
    try {
      const { data, mediaType } = await fileToBase64(file);
      const results = await scanReceipt(data, mediaType, profile.language, settings);
      if (results.length === 0) {
        setStep({ name: 'error', message: t('nothingDetected') });
        return;
      }
      setStep({ name: 'review-bulk', items: results.map(r => ({ ...r, selected: true })) });
    } catch (e: any) {
      setStep({ name: 'error', message: e?.message ?? t('cameraError') });
    }
  }

  // ─── Save helpers ──────────────────────────────────────────

  async function saveSingle(draft: DraftIngredient) {
    await addIngredient(makeIngredient(draft));
    onClose();
  }

  async function saveBulk(items: DraftIngredient[]) {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) { onClose(); return; }
    await bulkAddIngredients(selected.map(makeIngredient));
    onClose();
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <Backdrop onClick={onClose}>
      <Sheet onClick={e => e.stopPropagation()}>
        {step.name === 'picker' && (
          <PickerView
            scannerId={scannerId}
            onBarcode={() => setStep({ name: 'barcode' })}
            onPhoto={() => photoInputRef.current?.click()}
            onReceipt={() => receiptInputRef.current?.click()}
            onClose={onClose}
            t={t}
          />
        )}

        {step.name === 'barcode' && (
          <BarcodeView
            scannerId={scannerId}
            onDetected={handleBarcodeDetected}
            onClose={onClose}
            t={t}
          />
        )}

        {step.name === 'barcode-not-found' && (
          <CenteredMessage
            emoji="🔍"
            title={t('barcodeNotFound')}
            body={t('barcodeNotFoundHint')}
          />
        )}

        {step.name === 'analyzing' && (
          <AnalyzingView hint={step.hint} />
        )}

        {step.name === 'review-single' && (
          <ReviewSingleView
            item={step.item}
            onConfirm={saveSingle}
            onBack={() => setStep({ name: 'picker' })}
            t={t}
          />
        )}

        {step.name === 'review-bulk' && (
          <ReviewBulkView
            items={step.items}
            onChange={items => setStep({ name: 'review-bulk', items })}
            onConfirm={saveBulk}
            onBack={() => setStep({ name: 'picker' })}
            t={t}
          />
        )}

        {step.name === 'error' && (
          <ErrorView
            message={step.message}
            onRetry={() => setStep({ name: 'picker' })}
            onClose={onClose}
            t={t}
          />
        )}

        {/* Hidden file inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ''; }}
        />
        <input
          ref={receiptInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f); e.target.value = ''; }}
        />
      </Sheet>
    </Backdrop>
  );
}

// ─── Backdrop + sheet layout ──────────────────────────────────

function Backdrop({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
}

function Sheet({ onClick, children }: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '100%', maxWidth: 520,
        background: T.surface2,
        borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.borderHi}`,
        borderBottom: 'none',
        overflow: 'hidden',
        maxHeight: '90dvh',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────

function PickerView({
  scannerId: _scannerId,
  onBarcode, onPhoto, onReceipt, onClose, t,
}: {
  scannerId: string;
  onBarcode: () => void;
  onPhoto: () => void;
  onReceipt: () => void;
  onClose: () => void;
  t: (k: any) => string;
}) {
  const options = [
    { emoji: '📦', label: t('scanBarcode'),       hint: t('scanBarcodeHint'),       action: onBarcode },
    { emoji: '📷', label: t('photographProduct'),  hint: t('photographProductHint'), action: onPhoto },
    { emoji: '🧾', label: t('scanReceipt'),        hint: t('scanReceiptHint'),       action: onReceipt },
  ];

  return (
    <div style={{ padding: '20px 20px 28px' }}>
      <SheetHeader title={t('addFromCamera')} onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {options.map(o => (
          <button
            key={o.label}
            onClick={o.action}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 14,
              background: T.surface, border: `1px solid ${T.border}`,
              cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>{o.emoji}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{o.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{o.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Barcode scanner ──────────────────────────────────────────

function BarcodeView({
  scannerId, onDetected, onClose, t,
}: {
  scannerId: string;
  onDetected: (barcode: string) => void;
  onClose: () => void;
  t: (k: any) => string;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    detectedRef.current = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 100 } },
        (decodedText) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          scanner.stop().catch(() => {}).finally(() => {
            scanner.clear();
            onDetected(decodedText);
          });
        },
        () => { /* per-frame errors are normal, ignore */ },
      )
      .catch((err: Error) => {
        const msg = err?.message ?? '';
        if (msg.toLowerCase().includes('permission')) {
          setError(t('cameraPermissionDenied'));
        } else {
          setError(t('cameraError'));
        }
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
      }
    };
  }, [scannerId, onDetected, t]);

  return (
    <div style={{ padding: '20px 20px 28px' }}>
      <SheetHeader title={t('scanBarcode')} onClose={onClose} />
      {error ? (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: T.dangerTint, color: T.danger, fontSize: 13 }}>
          {error}
        </div>
      ) : (
        <>
          <div
            id={scannerId}
            style={{
              marginTop: 16, borderRadius: 14,
              overflow: 'hidden',
              background: '#000',
              minHeight: 260,
            }}
          />
          <div style={{ marginTop: 12, fontSize: 12, color: T.muted, textAlign: 'center' }}>
            {t('scanBarcodeHint')}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Analyzing spinner ────────────────────────────────────────

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

function ReviewSingleView({
  item, onConfirm, onBack, t,
}: {
  item: DraftIngredient;
  onConfirm: (item: DraftIngredient) => void;
  onBack: () => void;
  t: (k: any) => string;
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
      <SheetHeader title={t('confirmIngredient')} onClose={onBack} backIcon />

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name */}
        <div>
          <label style={labelStyle}>{t('name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </div>

        {/* Amount */}
        <div>
          <label style={labelStyle}>{t('amountOpt')}</label>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={t('amountPlaceholder')}
            style={inputStyle}
          />
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>{t('category')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  padding: '7px 12px', borderRadius: 999,
                  background: category === c ? T.accentTint : T.surface,
                  border: `1px solid ${category === c ? T.borderAcc : T.border}`,
                  color: category === c ? T.accent : T.text2,
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >
                {catLabels[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        disabled={!name.trim()}
        onClick={() => onConfirm({ name, amount: amount || undefined, category, selected: true })}
        style={{
          marginTop: 22, width: '100%', padding: '14px',
          borderRadius: 14, border: 'none',
          background: name.trim() ? T.accentGrad : T.surface,
          color: name.trim() ? '#1a1208' : T.muted,
          fontSize: 15, fontWeight: 700,
          cursor: name.trim() ? 'pointer' : 'not-allowed',
          fontFamily: T.font,
        }}
      >
        {t('addToPantry')}
      </button>
    </div>
  );
}

// ─── Review bulk ──────────────────────────────────────────────

function ReviewBulkView({
  items, onChange, onConfirm, onBack, t,
}: {
  items: DraftIngredient[];
  onChange: (items: DraftIngredient[]) => void;
  onConfirm: (items: DraftIngredient[]) => void;
  onBack: () => void;
  t: (k: any) => string;
}) {
  const selectedCount = items.filter(i => i.selected).length;
  const allSelected = selectedCount === items.length;

  function toggle(idx: number) {
    onChange(items.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  }
  function toggleAll() {
    onChange(items.map(it => ({ ...it, selected: !allSelected })));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <SheetHeader title={t('foundNIngredients').replace('{n}', String(items.length))} onClose={onBack} backIcon />
        <button
          onClick={toggleAll}
          style={{
            marginTop: 12, padding: '6px 14px', borderRadius: 999,
            border: `1px solid ${T.border}`, background: T.surface,
            color: T.text2, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: T.font,
          }}
        >
          {allSelected ? t('deselectAll') : t('selectAll')}
        </button>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, idx) => (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 12,
                background: it.selected ? T.accentTint : T.surface,
                border: `1px solid ${it.selected ? T.borderAcc : T.border}`,
                cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
              }}
            >
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
                {it.amount && (
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{it.amount}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ padding: '12px 20px 28px', flexShrink: 0, borderTop: `1px solid ${T.border}` }}>
        <button
          disabled={selectedCount === 0}
          onClick={() => onConfirm(items)}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 14, border: 'none',
            background: selectedCount > 0 ? T.accentGrad : T.surface,
            color: selectedCount > 0 ? '#1a1208' : T.muted,
            fontSize: 15, fontWeight: 700,
            cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
            fontFamily: T.font,
          }}
        >
          {t('importNItems').replace('{n}', String(selectedCount))}
        </button>
      </div>
    </div>
  );
}

// ─── Error view ───────────────────────────────────────────────

function ErrorView({ message, onRetry, onClose, t }: {
  message: string; onRetry: () => void; onClose: () => void; t: (k: any) => string;
}) {
  return (
    <div style={{ padding: '32px 20px 28px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>{t('errorTitle')}</div>
      <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, marginBottom: 24 }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ ...ghostBtnStyle, flex: 1 }}>{t('cancel')}</button>
        <button onClick={onRetry} style={{ ...accentBtnStyle, flex: 1 }}>{t('retry')}</button>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────

function CenteredMessage({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function SheetHeader({ title, onClose, backIcon = false }: {
  title: string; onClose: () => void; backIcon?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{title}</div>
      <button
        onClick={onClose}
        style={{
          width: 30, height: 30, borderRadius: 999,
          border: 'none', background: T.surface,
          color: T.text2, cursor: 'pointer',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.font,
        }}
      >
        {backIcon ? '←' : '✕'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12, fontWeight: 600, color: T.text2,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: T.surface, border: `1px solid ${T.border}`,
  color: T.text, fontSize: 14, fontFamily: T.font,
  outline: 'none', boxSizing: 'border-box',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '12px', borderRadius: 12,
  background: T.surface, color: T.text2,
  border: `1px solid ${T.border}`,
  cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: T.font,
};

const accentBtnStyle: React.CSSProperties = {
  padding: '12px', borderRadius: 12,
  background: T.accentGrad, color: '#1a1208',
  border: 'none',
  cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: T.font,
};
