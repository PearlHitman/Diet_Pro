// Pantry — ingredient list grouped by category.
// Header "+ " button opens a dropdown menu (write / photo / receipt).
// File inputs are triggered synchronously from the menu so iOS grants
// camera permission correctly.

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { CameraImport, type CameraMode } from '../components/CameraImport';
import { T } from '../tokens';
import { Package, Plus, Trash } from '../components/Icons';
import { useApp } from '../lib/app-state';
import type { Category, Ingredient } from '../lib/types';

const CATEGORY_ORDER: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function PantryPage() {
  const { pantry, removeIngredient, t } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [captured, setCaptured] = useState<{ file: File; mode: CameraMode } | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const out: Record<Category, Ingredient[]> = {
      produce: [], protein: [], dairy: [], grains: [], pantry: [], other: [],
    };
    for (const it of pantry) out[it.category].push(it);
    return out;
  }, [pantry]);

  const fadeIndex = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const cat of CATEGORY_ORDER) for (const it of grouped[cat]) map[it.id] = idx++;
    return map;
  }, [grouped]);

  const catLabel: Record<Category, ReturnType<typeof t>> = {
    produce: t('cat_produce'), protein: t('cat_protein'),
    dairy: t('cat_dairy'), grains: t('cat_grains'),
    pantry: t('cat_pantry'), other: t('cat_other'),
  };

  function handleMenuOption(option: 'manual' | 'photo' | 'receipt') {
    setMenuOpen(false);
    if (option === 'manual') { navigate('/pantry/add'); return; }
    if (option === 'photo') photoRef.current?.click();
    if (option === 'receipt') receiptRef.current?.click();
  }

  return (
    <Screen>
      <SubHeader
        title={t('pantry')}
        right={
          <div style={{ position: 'relative' }}>
            <button
              aria-label="Add"
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: T.accentTint, color: T.accent, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={18} />
            </button>

            {menuOpen && (
              <>
                {/* Transparent overlay to close on outside tap */}
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                />
                <div style={{
                  position: 'absolute', top: 38, right: 0, zIndex: 11,
                  background: T.surface2,
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: 200,
                  overflow: 'hidden',
                }}>
                  {([
                    { key: 'manual',  emoji: '✏️', label: t('addIngredient') },
                    { key: 'photo',   emoji: '📷', label: t('photographProduct') },
                    { key: 'receipt', emoji: '🧾', label: t('scanReceipt') },
                  ] as const).map((item, idx, arr) => (
                    <button
                      key={item.key}
                      onClick={() => handleMenuOption(item.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '13px 16px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: idx < arr.length - 1 ? `1px solid ${T.border}` : 'none',
                        color: T.text, cursor: 'pointer',
                        fontSize: 14, fontWeight: 500, fontFamily: T.font,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{item.emoji}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        }
      />

      {/* Hidden file inputs — triggered directly from menu so iOS allows camera */}
      <input
        ref={photoRef}
        type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCaptured({ file: f, mode: 'photo' });
          e.target.value = '';
        }}
      />
      <input
        ref={receiptRef}
        type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCaptured({ file: f, mode: 'receipt' });
          e.target.value = '';
        }}
      />

      {pantry.length === 0 ? (
        <EmptyState onAdd={() => setMenuOpen(true)} />
      ) : (
        <div style={{ padding: '14px 16px 28px' }}>
          {CATEGORY_ORDER.map(cat => grouped[cat].length === 0 ? null : (
            <div key={cat} style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', color: T.accent, marginBottom: 10,
              }}>{catLabel[cat]}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grouped[cat].map(it => (
                  <IngredientRow
                    key={it.id}
                    item={it}
                    onEdit={() => navigate(`/pantry/edit/${it.id}`)}
                    onDelete={() => setConfirming(it.id)}
                    fadeIdx={fadeIndex[it.id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {captured && (
        <CameraImport
          file={captured.file}
          mode={captured.mode}
          onClose={() => setCaptured(null)}
        />
      )}

      {confirming && (
        <DeleteConfirm
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await removeIngredient(confirming);
            setConfirming(null);
          }}
        />
      )}
    </Screen>
  );
}

function IngredientRow({
  item, onEdit, onDelete, fadeIdx = 0,
}: { item: Ingredient; onEdit: () => void; onDelete: () => void; fadeIdx?: number }) {
  const { t } = useApp();
  const d = daysUntil(item.expiresOn);

  let dotColor: string = T.mute2;
  let when = '';
  if (d !== null) {
    if (d < 0)        { dotColor = T.danger;  when = t('expired'); }
    else if (d === 0) { dotColor = T.danger;  when = t('expiresToday'); }
    else if (d <= 3)  { dotColor = T.warning; when = `${d}${t('daysShort')}`; }
    else              { dotColor = T.muted;   when = `${d}${t('daysShort')}`; }
  }

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${fadeIdx * 30}ms`,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 999, background: dotColor }} />
      <button
        type="button"
        onClick={onEdit}
        style={{
          flex: 1, textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, fontFamily: T.font,
        }}
      >
        <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{item.name}</div>
        {item.amount && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{item.amount}</div>
        )}
      </button>
      {when && (
        <div style={{ fontSize: 12, color: dotColor, fontWeight: 600 }}>{when}</div>
      )}
      <button
        aria-label="Delete"
        onClick={onDelete}
        style={{
          width: 28, height: 28, borderRadius: 7,
          border: 'none', background: 'transparent', color: T.mute2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      ><Trash size={14} /></button>
    </div>
  );
}

function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useApp();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: 320, background: T.surface2,
        borderRadius: 18, border: `1px solid ${T.borderHi}`,
        padding: '22px 22px 18px',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>
          {t('deleteConfirmTitle')}
        </div>
        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, marginBottom: 18 }}>
          {t('deleteConfirmBody')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', borderRadius: 11,
            background: T.surface, color: T.text2,
            border: `1px solid ${T.border}`, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: T.font,
          }}>{t('cancel')}</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px', borderRadius: 11,
            background: T.dangerTint, color: T.danger,
            border: `1px solid rgba(248,113,113,0.3)`, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: T.font,
          }}>{t('delete')}</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useApp();
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: T.surface, border: `1px solid ${T.border}`,
        color: T.mute2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Package size={28} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text2, marginBottom: 6 }}>
        {t('pantryEmpty')}
      </div>
      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 22 }}>
        {t('pantryEmptyHint')}
      </div>
      <button onClick={onAdd} style={{
        padding: '12px 22px', borderRadius: 12,
        background: T.accentGrad, color: '#1a1208',
        border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 700, fontFamily: T.font,
      }}>{t('addIngredient')}</button>
    </div>
  );
}
