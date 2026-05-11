// Loading screen — fires the Claude API call and navigates to /results on
// success, back to /generate on error (with an error message).
//
// We use a ref to ensure the request fires exactly once even under React
// 18 StrictMode (which double-invokes effects in dev). Otherwise we'd
// charge the user's API quota twice per generation.

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen } from '../components/Chrome';
import { Sparkles, AlertCircle, ArrowLeft } from '../components/Icons';
import { T, SCREEN_PAD_TOP } from '../tokens';
import { useApp } from '../lib/app-state';
import { generateRecipes, ClaudeError } from '../lib/claude';
import type { MealType, Recipe } from '../lib/types';

interface LocationState { mealType?: MealType }

export function LoadingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pantry, profile, settings, appendRecipes, t } = useApp();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const mealType = (location.state as LocationState | null)?.mealType;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!mealType) {
      navigate('/generate', { replace: true });
      return;
    }

    (async () => {
      try {
        const recipes = await generateRecipes({ pantry, profile, mealType, settings });
        await appendRecipes(recipes);
        navigate('/results', { state: { ids: recipes.map(r => r.id) }, replace: true });
      } catch (e) {
        if (e instanceof ClaudeError) {
          const map: Record<ClaudeError['kind'], any> = {
            auth: 'errorNoKey', rate: 'errorRate',
            network: 'errorNetwork', parse: 'errorParse', unknown: 'errorTitle',
          };
          setError(t(map[e.kind]));
        } else {
          setError(t('errorTitle'));
        }
      }
    })();
  }, [mealType]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/generate', { replace: true })}
              style={{
                padding: '11px 18px', borderRadius: 11,
                background: T.surface, color: T.text2,
                border: `1px solid ${T.border}`, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: T.font,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            ><ArrowLeft size={14} />{t('back')}</button>
            <button
              onClick={() => { startedRef.current = false; setError(null); }}
              style={{
                padding: '11px 18px', borderRadius: 11,
                background: T.accentGrad, color: '#1a1208',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: T.font,
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
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: T.accentTint, border: `1px solid ${T.borderAcc}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 22px',
          animation: 'pulse 1.6s ease-in-out infinite',
        }}><Sparkles size={28} color={T.accent} /></div>

        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          {t('generating')}
        </div>
        <div style={{ fontSize: 13, color: T.muted }}>
          {t('generatingHint')}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50%      { opacity: 1;   transform: scale(1.05); }
          }
        `}</style>
      </div>
    </Screen>
  );
}
