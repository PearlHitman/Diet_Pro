// History — combined history + favorites view, switched via segmented tab.
// /history?view=all (default) or /history?view=favs.

import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { BookOpen } from '../components/Icons';
import { useApp } from '../lib/app-state';
import type { Recipe } from '../lib/types';
import { prefersReducedMotion } from '../lib/motion';

type View = 'all' | 'favs';

export function HistoryPage() {
  const { recipes, t } = useApp();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'favs' ? 'favs' : 'all';

  const list = useMemo<Recipe[]>(
    () => (view === 'favs' ? recipes.filter(r => r.starred) : recipes),
    [recipes, view],
  );

  const setView = (next: View) => {
    const updated = new URLSearchParams(params);
    if (next === 'all') updated.delete('view');
    else updated.set('view', next);
    setParams(updated, { replace: true });
  };

  const reduceMotion = prefersReducedMotion();

  return (
    <Screen>
      <div style={{ padding: '8px 20px 28px' }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            lineHeight: '40px',
            letterSpacing: -0.6,
            color: 'var(--mise-text-primary)',
            fontFamily: 'var(--mise-font-display)',
            margin: '0 0 20px 0',
          }}
        >
          {t('history')}
        </h1>

        {/* Segmented control */}
        <div
          role="tablist"
          aria-label={t('history')}
          style={{
            display: 'inline-flex',
            padding: 4,
            gap: 2,
            borderRadius: 'var(--mise-radius-button)',
            background: 'var(--mise-glass-fill)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid var(--mise-glass-border)',
            boxShadow: 'var(--mise-shadow-sm)',
            marginBottom: 24,
          }}
        >
          <SegBtn active={view === 'all'} onClick={() => setView('all')} label={t('allRecipes')} count={recipes.length} />
          <SegBtn active={view === 'favs'} onClick={() => setView('favs')} label={t('favorites')} count={recipes.filter(r => r.starred).length} />
        </div>

        {list.length === 0 ? (
          <EmptyState
            title={view === 'favs' ? t('noFavoritesYet') : t('noRecipesYet')}
            hint={view === 'favs' ? t('noFavoritesHint') : t('noRecipesHint')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((r, i) => (
              <div
                key={r.id}
                className={reduceMotion ? undefined : 'fade-up'}
                style={!reduceMotion ? { animationDelay: `${i * 30}ms` } : {}}
              >
                <RecipeCard recipe={r} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

function SegBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  const reduceMotion = prefersReducedMotion();
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="press"
      style={{
        padding: '8px 16px',
        borderRadius: 10,
        border: 'none',
        background: active ? 'var(--mise-primary)' : 'transparent',
        color: active ? 'var(--mise-text-on-primary)' : 'var(--mise-text-secondary)',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: -0.1,
        fontFamily: 'var(--mise-font-text)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...(reduceMotion ? { transition: 'none' } : { transition: 'background 0.2s, color 0.2s' }),
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          padding: '2px 7px',
          borderRadius: 999,
          background: active ? 'rgba(255,255,255,0.25)' : 'rgba(124, 58, 237, 0.10)',
          color: active ? '#FFFFFF' : 'var(--mise-primary)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
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
        <BookOpen size={32} />
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
        {title}
      </div>
      <div
        style={{
          fontSize: 15,
          color: 'var(--mise-text-secondary)',
          lineHeight: 1.5,
          maxWidth: 320,
          margin: '0 auto',
        }}
      >
        {hint}
      </div>
    </div>
  );
}
