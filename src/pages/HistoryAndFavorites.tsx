// History — every recipe ever generated, capped at 50 (except starred).
// Cursor task: group by day with date headers (look at how design canvas
// renders this if you want a reference, otherwise the flat list works).

import React from 'react';
import { Screen, SubHeader } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { BookOpen } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';

export function HistoryPage() {
  const { recipes, t } = useApp();
  return (
    <Screen>
      <SubHeader title={t('history')} />
      {recipes.length === 0 ? (
        <EmptyState
          title={t('noRecipesYet')}
          hint={t('noRecipesHint')}
        />
      ) : (
        <div style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </Screen>
  );
}

export function FavoritesPage() {
  const { recipes, t } = useApp();
  const stars = recipes.filter(r => r.starred);
  return (
    <Screen>
      <SubHeader title={t('favorites')} />
      {stars.length === 0 ? (
        <EmptyState
          title={t('noFavoritesYet')}
          hint={t('noFavoritesHint')}
        />
      ) : (
        <>
          <div style={{ padding: '14px 16px 6px', fontSize: 13, color: T.muted }}>
            <strong style={{ color: T.text, fontWeight: 600 }}>{stars.length}</strong>{' '}
            {t('savedRecipes')}
          </div>
          <div style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stars.map(r => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        </>
      )}
    </Screen>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: T.surface, border: `1px solid ${T.border}`, color: T.mute2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}><BookOpen size={22} /></div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text2, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}
