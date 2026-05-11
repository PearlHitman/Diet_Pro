// Home page — V4 "Pantry-led" variant adapted from homes.jsx.
// Shows greeting, pantry summary, expiring-soon highlights, generate CTA.

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen, AppHeader } from '../components/Chrome';
import { ArrowRight, BookOpen, Heart, Settings, User, AlertCircle } from '../components/Icons';
import { T } from '../tokens';
import { useApp } from '../lib/app-state';
import type { Ingredient } from '../lib/types';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function expiringSoon(pantry: Ingredient[]): Ingredient[] {
  return pantry
    .filter(it => {
      const d = daysUntil(it.expiresOn);
      return d !== null && d <= 3;
    })
    .sort((a, b) => (daysUntil(a.expiresOn) ?? 999) - (daysUntil(b.expiresOn) ?? 999))
    .slice(0, 4);
}

export function HomePage() {
  const { pantry, profile, settings, t } = useApp();
  const navigate = useNavigate();
  const expiring = expiringSoon(pantry);
  const needsKey = !settings.apiKey;
  const canGenerate = pantry.length > 0 && !!settings.apiKey;

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '14px 20px 28px' }}>
        {/* Greeting */}
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5, lineHeight: 1.15,
          }}>
            {t('welcomeBack')}{profile.name ? `, ${profile.name}` : ''}.
          </div>
          <div style={{ fontSize: 13, color: T.text2, marginTop: 4 }}>
            {t('youHave')} <strong style={{ color: T.text, fontWeight: 600 }}>{pantry.length} {t('ingredients')}</strong>.
          </div>
        </div>

        {/* API key warning */}
        {needsKey && (
          <Link to="/settings" style={{ textDecoration: 'none' }}>
            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: T.warnTint, border: `1px solid ${T.warnBord}`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 10,
              color: T.text2, fontSize: 13,
            }}>
              <AlertCircle size={16} color={T.warning} />
              <span style={{ flex: 1 }}>{t('errorNoKey')}</span>
              <ArrowRight size={14} color={T.warning} />
            </div>
          </Link>
        )}

        {/* Expiring */}
        {expiring.length > 0 && (
          <div style={{
            marginTop: 22, padding: '14px 14px 12px',
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 14,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
              textTransform: 'uppercase', color: T.warning, marginBottom: 10,
            }}>{t('expiringSoon')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {expiring.map(it => {
                const d = daysUntil(it.expiresOn);
                const when = d === null ? '' :
                  d < 0 ? t('expired') :
                  d === 0 ? t('expiresToday') :
                  `${d}${t('daysShort')}`;
                return (
                  <div key={it.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, color: T.text,
                  }}>
                    <span>{it.name}</span>
                    <span style={{ color: (d ?? 999) <= 1 ? T.danger : T.muted, fontSize: 12, fontWeight: 600 }}>
                      {when}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate CTA */}
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => navigate('/generate')}
          style={{
            marginTop: 28,
            border: 'none', background: 'transparent', padding: 0,
            color: canGenerate ? T.accent : T.muted,
            fontFamily: T.font,
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 22, fontWeight: 600, letterSpacing: -0.5,
          }}
        >
          {t('generateRecipe')}
          <ArrowRight size={22} />
        </button>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>
          {t('threeOptionsNote')}
        </div>

        {/* Nav grid */}
        <div style={{
          marginTop: 36,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          <NavTile to="/pantry"    icon={<BookOpen size={18} color={T.accent} />} label={t('pantry')} sub={`${pantry.length}`} />
          <NavTile to="/history"   icon={<BookOpen size={18} color={T.text2} />}  label={t('history')}   />
          <NavTile to="/favorites" icon={<Heart size={18} color={T.text2} />}     label={t('favorites')} />
          <NavTile to="/profile"   icon={<User size={18} color={T.text2} />}      label={t('profile')}   />
          <NavTile to="/settings"  icon={<Settings size={18} color={T.text2} />}  label={t('settings')}  />
        </div>
      </div>
    </Screen>
  );
}

function NavTile({ to, icon, label, sub }: { to: string; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: '14px 14px',
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {icon}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</div>
        </div>
        {sub && <div style={{ fontSize: 13, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
      </div>
    </Link>
  );
}
