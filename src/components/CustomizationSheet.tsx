// Bottom-sheet modal for marking pantry items as "must include" or
// "skip" before generating recipes. Keeps a local draft until Apply is
// pressed so the user can experiment without committing.
//
// Cap rules (enforced here, also reinforced in the prompt):
//   • At most 1 must-include from the protein category.
//   • At most 3 must-include from all other categories combined.
//   • No cap on "skip".

import React, { useEffect, useState } from 'react';
import { T } from '../tokens';
import { Check, X } from './Icons';
import { PrimaryButton, GhostButton } from './Forms';
import { useApp } from '../lib/app-state';
import {
  EMPTY_CUSTOMIZATION,
  type Category,
  type Customization,
  type Ingredient,
} from '../lib/types';

interface CustomizationSheetProps {
  open: boolean;
  onClose: () => void;
  pantry: Ingredient[];
  initial: Customization;
  onApply: (next: Customization) => void;
}

const CATEGORY_ORDER: Category[] = ['protein', 'produce', 'grains', 'dairy', 'pantry', 'other'];

const CATEGORY_EMOJI: Record<Category, string> = {
  protein: '🥩',
  produce: '🥗',
  grains:  '🌾',
  dairy:   '🧀',
  pantry:  '🫒',
  other:   '🍴',
};

const CATEGORY_LABEL_KEY = {
  protein: 'cat_protein',
  produce: 'cat_produce',
  grains:  'cat_grains',
  dairy:   'cat_dairy',
  pantry:  'cat_pantry',
  other:   'cat_other',
} as const;

type ChipState = 'neutral' | 'must' | 'skip';

function chipState(name: string, draft: Customization): ChipState {
  const key = name.toLowerCase();
  if (draft.mustInclude.includes(key)) return 'must';
  if (draft.skip.includes(key)) return 'skip';
  return 'neutral';
}

// Count current must-includes that share a category with `cat`. Protein
// has its own cap (1), everything else shares a single cap (3).
function mustCountForCategory(cat: Category, draft: Customization, pantry: Ingredient[]): number {
  const draftNames = new Set(draft.mustInclude);
  if (cat === 'protein') {
    return pantry.filter(p => p.category === 'protein' && draftNames.has(p.name.toLowerCase())).length;
  }
  return pantry.filter(p => p.category !== 'protein' && draftNames.has(p.name.toLowerCase())).length;
}

function capForCategory(cat: Category): number {
  return cat === 'protein' ? 1 : 3;
}

// ─── Chip ────────────────────────────────────────────────────

function Chip({
  name, state, disabled, onClick,
}: { name: string; state: ChipState; disabled: boolean; onClick: () => void }) {
  const base = {
    padding: '8px 13px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600 as const,
    fontFamily: T.font,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    lineHeight: 1.1,
    opacity: disabled ? 0.45 : 1,
  };
  let styled: React.CSSProperties;
  if (state === 'must') {
    styled = { ...base, background: T.accentTint, borderColor: T.borderAcc, color: T.accent };
  } else if (state === 'skip') {
    styled = { ...base, background: T.dangerTint, borderColor: 'rgba(248,113,113,0.3)', color: T.danger };
  } else {
    styled = { ...base, background: T.surface, borderColor: T.border, color: T.text2 };
  }
  return (
    <button type="button" className="press" onClick={onClick} disabled={disabled} style={styled}>
      {state === 'must' && <Check size={12} />}
      {state === 'skip' && <X size={12} />}
      <span>{name}</span>
    </button>
  );
}

// ─── Sheet ───────────────────────────────────────────────────

export function CustomizationSheet({
  open, onClose, pantry, initial, onApply,
}: CustomizationSheetProps) {
  const { t } = useApp();
  const [draft, setDraft] = useState<Customization>(initial);

  // Reset local draft to whatever the parent passed in whenever we open.
  // Mutations only flow upward via onApply, so this is the right moment
  // to seed.
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  // Prevent the page behind the sheet from scrolling.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  function cycle(item: Ingredient) {
    const key = item.name.toLowerCase();
    const state = chipState(item.name, draft);

    if (state === 'neutral') {
      // Cap check for the must-include transition. Already-must/skip chips
      // bypass this because they cycle to a different state.
      const cap = capForCategory(item.category);
      const used = mustCountForCategory(item.category, draft, pantry);
      if (used >= cap) return; // no-op; shake animation comes in a later pass

      setDraft({ ...draft, mustInclude: [...draft.mustInclude, key] });
    } else if (state === 'must') {
      setDraft({
        mustInclude: draft.mustInclude.filter(n => n !== key),
        skip: [...draft.skip, key],
      });
    } else {
      setDraft({ ...draft, skip: draft.skip.filter(n => n !== key) });
    }
  }

  const isEmpty = pantry.length === 0;

  // Group pantry by category in the prescribed display order.
  const grouped: { cat: Category; items: Ingredient[] }[] = CATEGORY_ORDER
    .map(cat => ({ cat, items: pantry.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0);

  const mustCount = draft.mustInclude.length;
  const skipCount = draft.skip.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="backdrop-fade"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 50,
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('customize')}
        className="sheet-slide-up"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          maxHeight: '88vh',
          background: T.surface2,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          paddingTop: 12,
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.4)',
          fontFamily: T.font,
        }}
      >
        {/* Drag handle indicator */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: 'rgba(255,255,255,0.15)',
          margin: '0 auto 10px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '4px 20px 14px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              {t('customize')}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {t('customizeSub')}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="press"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: 'none', background: 'transparent', color: T.text2,
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={18} /></button>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: isEmpty ? '40px 20px' : '16px 20px',
        }}>
          {isEmpty ? (
            <div style={{
              textAlign: 'center', color: T.text2, fontSize: 14, lineHeight: 1.5,
              padding: '20px 0',
            }}>{t('emptyPantryForCustomize')}</div>
          ) : grouped.map(({ cat, items }) => {
            const used = mustCountForCategory(cat, draft, pantry);
            const cap = capForCategory(cat);
            return (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, fontWeight: 600, letterSpacing: 0.4,
                    textTransform: 'uppercase', color: T.muted,
                  }}>
                    <span style={{ fontSize: 14 }}>{CATEGORY_EMOJI[cat]}</span>
                    {t(CATEGORY_LABEL_KEY[cat])}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: used >= cap ? T.accent : T.mute2,
                    fontVariantNumeric: 'tabular-nums',
                  }}>{used}/{cap}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {items.map(it => {
                    const state = chipState(it.name, draft);
                    const atCap = state === 'neutral' && used >= cap;
                    return (
                      <Chip
                        key={it.id}
                        name={it.name}
                        state={state}
                        disabled={atCap}
                        onClick={() => cycle(it)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          padding: '12px 20px calc(14px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.border}`,
          background: T.surface2,
        }}>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.3 }}>
            <span style={{ color: T.accent }}>✓</span> {mustCount} {t('mustIncludeLabel')}
            {' · '}
            <span style={{ color: T.danger }}>✗</span> {skipCount} {t('skipLabel')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isEmpty ? (
              <>
                <span style={{ opacity: 0.5 }}>
                  <GhostButton onClick={() => {}}>{t('reset')}</GhostButton>
                </span>
                <PrimaryButton disabled onClick={() => {}}>{t('apply')}</PrimaryButton>
              </>
            ) : (
              <>
                <GhostButton onClick={() => setDraft(EMPTY_CUSTOMIZATION)}>{t('reset')}</GhostButton>
                <PrimaryButton onClick={() => { onApply(draft); onClose(); }}>{t('apply')}</PrimaryButton>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
