// Add / Edit ingredient form. Single page handles both flows based on
// presence of :id param.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { Field, Input, PrimaryButton } from '../components/Forms';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import type { Category, Ingredient } from '../lib/types';

const CATS: Category[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'other'];

export function IngredientFormPage() {
  const { id } = useParams<{ id: string }>();
  const { pantry, addIngredient, updateIngredient, t } = useApp();
  const navigate = useNavigate();
  const editing = id ? pantry.find(i => i.id === id) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState<Category>(editing?.category ?? 'produce');
  const [expiresOn, setExpiresOn] = useState(editing?.expiresOn ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? '');

  // If editing a removed item (race condition), bounce back.
  useEffect(() => {
    if (id && !editing) navigate('/pantry', { replace: true });
  }, [id, editing, navigate]);

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    if (editing) {
      await updateIngredient(editing.id, {
        name: name.trim(),
        category,
        expiresOn: expiresOn || null,
        amount: amount.trim() || undefined,
      });
    } else {
      const item: Ingredient = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        category,
        expiresOn: expiresOn || null,
        amount: amount.trim() || undefined,
        addedAt: new Date().toISOString(),
      };
      await addIngredient(item);
    }
    navigate('/pantry');
  }

  return (
    <Screen style={{ display: 'flex', flexDirection: 'column' }}>
      <SubHeader title={editing ? t('edit') : t('addIngredient')} />

      {/* Scrollable form content — grows to fill remaining height */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Field label={t('name')}>
          <Input value={name} onChange={setName} placeholder="Chicken breast" autoFocus />
        </Field>

        <Field label={t('category')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  padding: '8px 14px', borderRadius: 999,
                  background: category === c ? T.accentTint : T.surface,
                  border: `1px solid ${category === c ? T.borderAcc : T.border}`,
                  color: category === c ? T.accent : T.text2,
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >
                {t(`cat_${c}` as const)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('expiryDate')} hint={t('expiryHint')}>
          <Input value={expiresOn} onChange={setExpiresOn} type="date" />
        </Field>

        <Field label={t('amountOpt')}>
          <Input value={amount} onChange={setAmount} placeholder={t('amountPlaceholder')} />
        </Field>
      </div>

      {/* Sticky save footer — stays visible even when keyboard is open */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--mise-glass-border)',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      }}>
        <PrimaryButton onClick={handleSave} disabled={!canSave} fullWidth>
          {t('save')}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
