// Results page — shows the 3 recipes just generated.
// We pass their IDs via location.state so we don't have to re-fetch or
// re-derive which are "new" vs older history.

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen, SubHeader } from '../components/Chrome';
import { RecipeCard } from '../components/RecipeCard';
import { GhostButton } from '../components/Forms';
import { Sparkles } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';

interface LocationState { ids?: string[] }

export function ResultsPage() {
  const { recipes, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const ids = (location.state as LocationState | null)?.ids ?? [];
  const shown = recipes.filter(r => ids.includes(r.id));

  // Fallback: if user reloaded and lost state, send them home.
  if (shown.length === 0) {
    return (
      <Screen>
        <SubHeader title={t('recipe')} onBack={() => navigate('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader title={t('recipe')} onBack={() => navigate('/')} />

      <div style={{
        padding: '14px 16px 28px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {shown.map((r, i) => (
          <div key={r.id} className="fade-up" style={{ animationDelay: `${i * 30}ms` }}>
            <RecipeCard recipe={r} expanded={i === 0} />
          </div>
        ))}

        <GhostButton
          onClick={() => navigate('/generate')}
          icon={<Sparkles size={14} color={T.accent} />}
          fullWidth
        >{t('generateMore')}</GhostButton>
      </div>
    </Screen>
  );
}
