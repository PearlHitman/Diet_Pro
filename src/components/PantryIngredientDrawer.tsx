import React, { useEffect, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './ui/drawer';
import { useApp } from '../lib/app-state';
import type { Category, Ingredient } from '../lib/types';

const CATS: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

export function PantryIngredientDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: Ingredient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateIngredient, t } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('produce');
  const [expiresOn, setExpiresOn] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setExpiresOn(item.expiresOn ?? '');
    setAmount(item.amount ?? '');
  }, [item]);

  const canSave = name.trim().length > 0;

  async function save() {
    if (!item || !canSave) return;
    await updateIngredient(item.id, {
      name: name.trim(),
      category,
      expiresOn: expiresOn || null,
      amount: amount.trim() || undefined,
    });
    onOpenChange(false);
  }

  const catLabels: Record<Category, string> = {
    produce: t('cat_produce'), protein: t('cat_protein'), dairy: t('cat_dairy'),
    grains: t('cat_grains'), pantry: t('cat_pantry'), other: t('cat_other'),
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="z-[110]"
        style={{
          height: '65vh',
          maxHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--mise-glass-elevated)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderTop: '1px solid var(--mise-glass-border)',
          borderRadius: '20px 20px 0 0',
        }}
      >
        <DrawerHeader>
          <DrawerTitle style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--mise-text-primary)',
            fontFamily: 'var(--mise-font-display)',
          }}>
            {t('pantryEditSheetTitle')}
          </DrawerTitle>
        </DrawerHeader>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 8px', minHeight: 0 }}>
          <label style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--mise-text-tertiary)',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {t('name')}
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus={open}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--mise-radius-input)',
              border: '1px solid var(--mise-glass-border)',
              background: 'var(--mise-glass-fill)',
              color: 'var(--mise-text-primary)',
              fontSize: 16,
              fontFamily: 'var(--mise-font-text)',
              boxSizing: 'border-box',
              marginBottom: 18,
            }}
          />

          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--mise-text-tertiary)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              {t('category')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="press-soft"
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--mise-radius-pill)',
                    background: category === c ? 'rgba(124, 58, 237, 0.14)' : 'var(--mise-glass-fill)',
                    border: `1px solid ${category === c ? 'var(--mise-primary)' : 'var(--mise-glass-border)'}`,
                    color: category === c ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--mise-font-text)',
                  }}
                >
                  {catLabels[c]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--mise-text-tertiary)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              {t('expiryDate')}
            </div>
            <input
              type="date"
              value={expiresOn}
              onChange={e => setExpiresOn(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--mise-radius-input)',
                border: '1px solid var(--mise-glass-border)',
                background: 'var(--mise-glass-fill)',
                color: 'var(--mise-text-primary)',
                fontSize: 16,
                fontFamily: 'var(--mise-font-text)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--mise-text-tertiary)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              {t('amountOpt')}
            </div>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('amountPlaceholder')}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--mise-radius-input)',
                border: '1px solid var(--mise-glass-border)',
                background: 'var(--mise-glass-fill)',
                color: 'var(--mise-text-primary)',
                fontSize: 16,
                fontFamily: 'var(--mise-font-text)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <DrawerFooter style={{ flexDirection: 'row', gap: 10 }}>
          <button
            type="button"
            className="press"
            onClick={() => onOpenChange(false)}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 'var(--mise-radius-button)',
              border: '1px solid var(--mise-glass-border)',
              background: 'var(--mise-glass-fill)',
              color: 'var(--mise-text-primary)',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="press-soft"
            disabled={!canSave}
            onClick={() => save()}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 'var(--mise-radius-button)',
              border: 'none',
              background: !canSave ? 'var(--mise-text-tertiary)' : 'var(--mise-primary)',
              color: '#FFFFFF',
              cursor: canSave ? 'pointer' : 'not-allowed',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('save')}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
