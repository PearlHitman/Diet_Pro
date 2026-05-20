// History — combined history + favorites view, switched via segmented tab.
// /history?view=all (default) or /history?view=favs.

import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { BookOpen } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import type { Recipe } from '../lib/types';
import { prefersReducedMotion } from '../lib/motion';

type View = 'all' | 'favs';

function localeFromLanguage(lang: 'EN' | 'EL' | 'ES'): string {
  if (lang === 'EL') return 'el-GR';
  if (lang === 'ES') return 'es-ES';
  return 'en-GB';
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function HistoryPage() {
  const { recipes, profile, t } = useApp();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'favs' ? 'favs' : 'all';

  const list = useMemo<Recipe[]>(
    () => (view === 'favs' ? recipes.filter(r => r.starred) : recipes),
    [recipes, view],
  );

  const sections = useMemo(() => {
    const locale = localeFromLanguage(profile.language);
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' });

    const todayStart = startOfLocalDay(new Date());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const byKey = new Map<string, { label: string; items: Recipe[]; dayStartMs: number }>();

    const sorted = [...list].sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    for (const r of sorted) {
      const created = new Date(r.createdAt);
      const dayStart = startOfLocalDay(created);
      const dayStartMs = dayStart.getTime();

      let label: string;
      if (dayStartMs === todayStart.getTime()) label = t('dateToday');
      else if (dayStartMs === yesterdayStart.getTime()) label = t('dateYesterday');
      else label = fmt.format(created);

      // Use a stable grouping key (local YYYY-MM-DD).
      const key = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
      const existing = byKey.get(key);
      if (existing) existing.items.push(r);
      else byKey.set(key, { label, items: [r], dayStartMs });
    }

    return Array.from(byKey.entries())
      .sort(([, a], [, b]) => b.dayStartMs - a.dayStartMs)
      .map(([key, v]) => ({ key, ...v }));
  }, [list, profile.language, t]);

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
            fontSize: T.fontSize.displayXl,
            fontWeight: 600,
            lineHeight: 1.25,
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
            {sections.map(section => (
              <div key={section.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    padding: '10px 0 6px',
                    marginTop: 2,
                    background: 'color-mix(in srgb, var(--mise-background) 88%, transparent)',
                    backdropFilter: 'blur(10px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(160%)',
                    borderBottom: '1px solid color-mix(in srgb, var(--mise-glass-border) 60%, transparent)',
                  }}
                >
                  <div
                    style={{
                      fontSize: T.fontSize.caption,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'var(--mise-text-tertiary)',
                      fontFamily: 'var(--mise-font-text)',
                    }}
                  >
                    {section.label}
                  </div>
                </div>

                {section.items.map((r, i) => (
                  <div
                    key={r.id}
                    className={reduceMotion ? undefined : 'fade-up'}
                    style={!reduceMotion ? { animationDelay: `${i * 30}ms` } : {}}
                  >
                    <RecipeCard recipe={r} />
                  </div>
                ))}
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
        fontSize: T.fontSize.body,
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
          fontSize: T.fontSize.tiny,
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
          fontSize: T.fontSize.h2,
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
          fontSize: T.fontSize.bodyLg,
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
