// Loading screen — fires the Claude API call and navigates to /results on
// success, back to /generate on error (with an error message).

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen } from '../components/Chrome';
import { Sparkles, AlertCircle, ArrowLeft } from '../components/Icons';
import { T, SCREEN_PAD_TOP } from '../tokens';
import { useApp } from '../lib/app-state';
import { generateRecipes, ClaudeError } from '../lib/claude';
import { EMPTY_CUSTOMIZATION, type Customization, type MealType } from '../lib/types';

interface LocationState {
  mealType?: MealType;
  customization?: Customization;
  dishIdea?: string;
}

export function LoadingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pantry, profile, settings, appendRecipes, t } = useApp();
  const [error, setError] = useState<string | null>(null);

  /** Increment to re-run generation (Retry) without remounting. */
  const [generationToken, setGenerationToken] = useState(0);

  const state = location.state as LocationState | null;
  const mealType = state?.mealType;
  const customization = state?.customization ?? EMPTY_CUSTOMIZATION;
  const dishIdeaTrimmed = state?.dishIdea?.trim();
  const fromDishFlow = !!(dishIdeaTrimmed && dishIdeaTrimmed.length > 0);

  useEffect(() => {
    if (!mealType) {
      navigate('/generate', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const recipes = await generateRecipes({
          pantry,
          profile,
          mealType,
          settings,
          customization,
          dishIdea: dishIdeaTrimmed || undefined,
        });
        if (cancelled) return;
        await appendRecipes(recipes);
        if (cancelled) return;
        navigate('/results', { state: { ids: recipes.map(r => r.id) }, replace: true });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ClaudeError) {
          const map: Record<ClaudeError['kind'], string> = {
            auth: t('errorNoKey'),
            rate: t('errorRate'),
            network: t('errorNetwork'),
            parse: t('errorParse'),
            unknown: t('errorTitle'),
          };
          setError(map[e.kind]);
        } else {
          setError(t('errorTitle'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mealType, generationToken]); // eslint-disable-line react-hooks/exhaustive-deps -- use latest closure on Retry

  if (error) {
    return (
      <Screen>
        <div style={{
          minHeight: `calc(100vh - ${SCREEN_PAD_TOP})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: T.dangerTint, border: '1px solid rgba(248,113,113,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}><AlertCircle size={22} color={T.danger} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            {t('errorTitle')}
          </div>
          <div style={{ fontSize: 14, color: T.text2, marginBottom: 24, lineHeight: 1.5 }}>
            {error}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() =>
                navigate(fromDishFlow ? '/dish' : '/generate', { replace: true })
              }
              style={{
                padding: '11px 18px', borderRadius: 11,
                background: T.surface, color: T.text2,
                border: `1px solid ${T.border}`, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: T.font,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            ><ArrowLeft size={14} />{t('back')}</button>
            <button
              onClick={() => {
                setError(null);
                setGenerationToken(k => k + 1);
              }}
              style={{
                padding: '12px 20px', borderRadius: 'var(--mise-radius-button)',
                background: 'var(--mise-primary)', color: '#FFFFFF',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: T.font,
                boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
              }}
            >{t('retry')}</button>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{
        minHeight: `calc(100vh - ${SCREEN_PAD_TOP})`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', textAlign: 'center',
      }}>
        <div
          className="pulse"
          style={{
            width: 64, height: 64, borderRadius: 18,
            background: T.accentTint, border: `1px solid ${T.borderAcc}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px',
          }}
        ><Sparkles size={28} color={T.accent} /></div>

        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          {t('generating')}
        </div>
        <div style={{ fontSize: 13, color: T.muted }}>
          {t('generatingHint')}
        </div>
      </div>
    </Screen>
  );
}
