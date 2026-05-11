// Shared screen chrome — adapted from your shell.jsx.
// Differences vs the design canvas:
//  • No IOSDevice frame (we're a real PWA, not a mocked iPhone)
//  • SCREEN_PAD_TOP uses safe-area-inset so it works on actual notches
//  • Header back-button uses react-router navigate

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { T, SCREEN_PAD_TOP } from '../tokens';
import { ArrowLeft, ChefHat, Globe, Home, Package, Clock, Heart, User, Settings } from './Icons';
import { useApp } from '../lib/app-state';

const TAB_ROUTES = ['/', '/pantry', '/history', '/favorites', '/profile', '/settings'];

export function Screen({ children, bg, style }: { children: React.ReactNode; bg?: string; style?: React.CSSProperties }) {
  const location = useLocation();
  const hasTabBar = TAB_ROUTES.includes(location.pathname);
  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: bg ?? T.bg,
      color: T.text, fontFamily: T.font,
      paddingTop: SCREEN_PAD_TOP,
      paddingBottom: hasTabBar
        ? 'calc(56px + env(safe-area-inset-bottom))'
        : 'env(safe-area-inset-bottom)',
      boxSizing: 'border-box',
      ...style,
    }}>{children}</div>
  );
}

export function AppHeader({ dense = false, right }: { dense?: boolean; right?: React.ReactNode }) {
  const { profile, t } = useApp();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: dense ? '10px 20px 6px' : '14px 20px 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: T.accentTint, color: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${T.borderAcc}`,
        }}>
          <ChefHat size={16} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, color: T.text }}>
          {t('appName')}
        </div>
      </div>
      {right ?? <LangPill lang={profile.language} />}
    </div>
  );
}

function LangPill({ lang }: { lang: 'EN' | 'EL' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 9px 5px 8px',
      borderRadius: 999,
      background: T.surface, border: `1px solid ${T.border}`,
      color: T.text2, fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>
      <Globe size={12} />{lang}
    </div>
  );
}

export function SubHeader({
  title, onBack, right,
}: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '14px 16px 10px',
      position: 'sticky', top: 0, zIndex: 5,
      background: 'rgba(10,10,15,0.72)',
      backdropFilter: 'blur(18px) saturate(180%)',
      WebkitBackdropFilter: 'blur(18px) saturate(180%)',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <button aria-label="Back" onClick={handleBack} style={{
        width: 32, height: 32, borderRadius: 8,
        border: 'none', background: 'transparent', color: T.text2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}>
        <ArrowLeft size={18} />
      </button>
      <div style={{
        flex: 1, textAlign: 'center',
        fontSize: 15, fontWeight: 600, letterSpacing: -0.2, color: T.text,
      }}>{title}</div>
      <div style={{ minWidth: 32, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

export function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
      textTransform: 'uppercase', color: color ?? T.accent,
      marginBottom: 10,
    }}>{children}</div>
  );
}

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useApp();

  if (!TAB_ROUTES.includes(location.pathname)) return null;

  const tabs = [
    { path: '/',          icon: Home,     label: t('home') },
    { path: '/pantry',    icon: Package,  label: t('pantry') },
    { path: '/history',   icon: Clock,    label: t('history') },
    { path: '/favorites', icon: Heart,    label: t('favorites') },
    { path: '/profile',   icon: User,     label: t('profile') },
    { path: '/settings',  icon: Settings, label: t('settings') },
  ] as const;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex',
      background: 'rgba(10,10,15,0.88)',
      backdropFilter: 'blur(18px) saturate(180%)',
      WebkitBackdropFilter: 'blur(18px) saturate(180%)',
      borderTop: `1px solid ${T.border}`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            aria-label={label}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4,
              padding: '10px 0',
              border: 'none', background: 'transparent',
              cursor: 'pointer',
              color: active ? T.accent : T.muted,
              fontFamily: T.font,
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
