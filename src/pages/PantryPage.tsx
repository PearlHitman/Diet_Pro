// Pantry — Mise Liquid Glass.
// 32px display title + purple add button → dropdown (manual / photo / receipt).
// Working search filter, glass ingredient rows grouped by category, freshness
// dot driven by daysUntil, glass delete confirm dialog.

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Camera, Receipt, Package } from 'lucide-react';
import { Screen } from '../components/Chrome';
import { CameraImport, type CameraMode } from '../components/CameraImport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useApp } from '../lib/app-state';
import type { Category, Ingredient } from '../lib/types';

const CATEGORY_ORDER: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

interface FreshnessInfo {
  dot: string;
  text: string;
  textColor: string;
}

function freshnessFor(item: Ingredient, t: (k: any, v?: any) => string): FreshnessInfo {
  const d = daysUntil(item.expiresOn);
  if (d === null) {
    return { dot: '#94A3B8', text: '', textColor: 'var(--mise-text-tertiary)' };
  }
  if (d < 0) {
    return { dot: 'var(--mise-error)', text: t('expired'), textColor: 'var(--mise-error)' };
  }
  if (d === 0) {
    return { dot: 'var(--mise-error)', text: t('expiresToday'), textColor: 'var(--mise-error)' };
  }
  if (d <= 3) {
    return {
      dot: 'var(--mise-warning)',
      text: `${d} ${d === 1 ? 'day' : 'days'}`,
      textColor: 'var(--mise-warning)',
    };
  }
  return {
    dot: 'var(--mise-success)',
    text: `${d} days`,
    textColor: 'var(--mise-text-secondary)',
  };
}

export function PantryPage() {
  const { pantry, removeIngredient, t } = useApp();
  const navigate = useNavigate();

  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [captured, setCaptured] = useState<{ file: File; mode: CameraMode } | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pantry;
    return pantry.filter(it => it.name.toLowerCase().includes(q));
  }, [pantry, query]);

  const grouped = useMemo(() => {
    const out: Record<Category, Ingredient[]> = {
      produce: [], protein: [], dairy: [], grains: [], pantry: [], other: [],
    };
    for (const it of filtered) out[it.category].push(it);
    return out;
  }, [filtered]);

  const fadeIndex = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const cat of CATEGORY_ORDER) for (const it of grouped[cat]) map[it.id] = idx++;
    return map;
  }, [grouped]);

  const catLabel: Record<Category, string> = {
    produce: t('cat_produce'),
    protein: t('cat_protein'),
    dairy: t('cat_dairy'),
    grains: t('cat_grains'),
    pantry: t('cat_pantry'),
    other: t('cat_other'),
  };

  function handleMenuOption(option: 'manual' | 'photo' | 'receipt') {
    if (option === 'manual') {
      navigate('/pantry/add');
      return;
    }
    if (option === 'photo') photoRef.current?.click();
    if (option === 'receipt') receiptRef.current?.click();
  }

  return (
    <Screen>
      <div style={{ padding: '8px 20px 28px' }}>
        {/* ── Header: title + purple add button ──────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: '40px',
              letterSpacing: -0.6,
              color: 'var(--mise-text-primary)',
              fontFamily: 'var(--mise-font-display)',
              margin: 0,
            }}
          >
            {t('myPantry')}
          </h1>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t('add')}
                className="press-soft"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--mise-radius-button)',
                  background: 'var(--mise-primary)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#FFFFFF',
                }}
              >
                <Plus size={24} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              style={{
                background: 'var(--mise-glass-elevated)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid var(--mise-glass-border)',
                borderRadius: 'var(--mise-radius-card)',
                boxShadow: 'var(--mise-shadow-lg)',
                padding: 6,
                minWidth: 220,
              }}
            >
              <MenuRow icon={<Pencil size={18} />} label={t('addIngredient')} onSelect={() => handleMenuOption('manual')} />
              <MenuRow icon={<Camera size={18} />} label={t('photographProduct')} onSelect={() => handleMenuOption('photo')} />
              <MenuRow icon={<Receipt size={18} />} label={t('scanReceipt')} onSelect={() => handleMenuOption('receipt')} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Search input ─────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            height: 48,
            background: 'var(--mise-glass-fill)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid var(--mise-glass-border)',
            borderRadius: 'var(--mise-radius-button)',
            boxShadow: 'var(--mise-shadow-glass)',
            marginBottom: 28,
          }}
        >
          <Search size={20} style={{ color: 'var(--mise-text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchIngredients')}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 17,
              lineHeight: '24px',
              color: 'var(--mise-text-primary)',
              fontFamily: 'var(--mise-font-text)',
            }}
          />
        </div>

        {/* ── Categories or empty state ────────────────────── */}
        {pantry.length === 0 ? (
          <EmptyState onAdd={() => navigate('/pantry/add')} />
        ) : filtered.length === 0 ? (
          <NoResults query={query} onClear={() => setQuery('')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {CATEGORY_ORDER.map(cat =>
              grouped[cat].length === 0 ? null : (
                <div key={cat}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: 'var(--mise-text-tertiary)',
                      marginBottom: 12,
                      fontFamily: 'var(--mise-font-text)',
                    }}
                  >
                    {catLabel[cat]}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Hidden file inputs (iOS camera permission) ────── */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCaptured({ file: f, mode: 'photo' });
          e.target.value = '';
        }}
      />
      <input
        ref={receiptRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCaptured({ file: f, mode: 'receipt' });
          e.target.value = '';
        }}
      />

      {captured && (
        <CameraImport
          file={captured.file}
          mode={captured.mode}
          onClose={() => setCaptured(null)}
        />
      )}

      <DeleteConfirmDialog
        open={confirming !== null}
        onOpenChange={open => { if (!open) setConfirming(null); }}
        onConfirm={async () => {
          if (confirming) {
            await removeIngredient(confirming);
            setConfirming(null);
          }
        }}
      />
    </Screen>
  );
}

/* ─── Ingredient row (glass card) ───────────────────────── */

function IngredientRow({
  item,
  onEdit,
  onDelete,
  fadeIdx = 0,
}: {
  item: Ingredient;
  onEdit: () => void;
  onDelete: () => void;
  fadeIdx?: number;
}) {
  const { t } = useApp();
  const fresh = freshnessFor(item, t);

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${fadeIdx * 30}ms`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-button)',
        boxShadow: 'var(--mise-shadow-glass)',
      }}
    >
      {/* Freshness dot */}
      <div
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: fresh.dot,
          boxShadow: `0 0 8px ${fresh.dot}40`,
          flexShrink: 0,
        }}
      />

      {/* Name + amount (tappable → edit) */}
      <button
        type="button"
        onClick={onEdit}
        style={{
          all: 'unset',
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--mise-font-text)',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            lineHeight: '24px',
            color: 'var(--mise-text-primary)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </div>
        {item.amount && (
          <div
            style={{
              fontSize: 15,
              lineHeight: '20px',
              color: 'var(--mise-text-secondary)',
            }}
          >
            {item.amount}
          </div>
        )}
      </button>

      {/* Expiry */}
      {fresh.text && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: '20px',
            color: fresh.textColor,
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          {fresh.text}
        </div>
      )}

      {/* Trash */}
      <button
        aria-label={t('delete')}
        onClick={onDelete}
        className="press"
        style={{
          all: 'unset',
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mise-text-tertiary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
}

/* ─── Add menu row ──────────────────────────────────────── */

function MenuRow({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 500,
        color: 'var(--mise-text-primary)',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--mise-primary)', display: 'inline-flex' }}>{icon}</span>
      {label}
    </DropdownMenuItem>
  );
}

/* ─── Empty state ───────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useApp();
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'rgba(124, 58, 237, 0.10)',
          color: 'var(--mise-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <Package size={36} />
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--mise-text-primary)',
          marginBottom: 8,
          fontFamily: 'var(--mise-font-display)',
        }}
      >
        {t('pantryEmpty')}
      </div>
      <div
        style={{
          fontSize: 15,
          color: 'var(--mise-text-secondary)',
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        {t('pantryEmptyHint')}
      </div>
      <button
        onClick={onAdd}
        className="press-soft"
        style={{
          padding: '12px 24px',
          borderRadius: 'var(--mise-radius-button)',
          background: 'var(--mise-primary)',
          color: '#FFFFFF',
          border: 'none',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 500,
          fontFamily: 'var(--mise-font-text)',
          boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
        }}
      >
        {t('addIngredient')}
      </button>
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: 'var(--mise-text-secondary)', marginBottom: 16 }}>
        No ingredients match “{query}”.
      </div>
      <button
        onClick={onClear}
        className="press"
        style={{
          padding: '10px 18px',
          borderRadius: 'var(--mise-radius-button)',
          background: 'var(--mise-glass-fill)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--mise-glass-border)',
          color: 'var(--mise-primary)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--mise-font-text)',
        }}
      >
        Clear search
      </button>
    </div>
  );
}

/* ─── Delete confirm dialog ─────────────────────────────── */

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useApp();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background: 'var(--mise-glass-elevated)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid var(--mise-glass-border)',
          borderRadius: 'var(--mise-radius-card)',
          boxShadow: 'var(--mise-shadow-xl)',
          padding: 24,
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontSize: 18, fontWeight: 600, color: 'var(--mise-text-primary)', fontFamily: 'var(--mise-font-display)' }}>
            {t('deleteConfirmTitle')}
          </DialogTitle>
          <DialogDescription style={{ fontSize: 14, color: 'var(--mise-text-secondary)', lineHeight: 1.5 }}>
            {t('deleteConfirmBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter style={{ marginTop: 16, gap: 8 }}>
          <button
            onClick={() => onOpenChange(false)}
            className="press"
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--mise-radius-button)',
              background: 'var(--mise-glass-fill)',
              border: '1px solid var(--mise-glass-border)',
              color: 'var(--mise-text-primary)',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="press"
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--mise-radius-button)',
              background: 'var(--mise-error)',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('delete')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
