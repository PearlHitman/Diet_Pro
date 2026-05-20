// Shared screen chrome — Mise Liquid Glass aesthetic.
// Light/dark via theme.css; safe-area aware for real PWA on iOS.

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, Home, Package, Clock, User, ArrowLeft, Globe, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../lib/app-state';
import { prefersReducedMotion } from '../lib/motion';

export const SCREEN_PAD_TOP = 'max(54px, env(safe-area-inset-top))';

const TAB_ROUTES = ['/', '/pantry', '/history', '/profile'];

export function Screen({
  children,
  bg,
  style,
  className,
}: {
  children: React.ReactNode;
  bg?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const location = useLocation();
  const hasTabBar = TAB_ROUTES.includes(location.pathname);
  return (
    <div
      className={className}
      style={{
        width: '100%',
        minHeight: '100vh',
        background: bg ?? 'var(--mise-background)',
        color: 'var(--mise-text-primary)',
        fontFamily: 'var(--mise-font-text)',
        paddingTop: SCREEN_PAD_TOP,
        paddingBottom: hasTabBar
          ? 'calc(72px + env(safe-area-inset-bottom))'
          : 'env(safe-area-inset-bottom)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function AppHeader({
  dense = false,
  right,
}: {
  dense?: boolean;
  right?: React.ReactNode;
}) {
  const { profile, t } = useApp();
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: dense ? '10px 20px 6px' : '14px 20px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(124, 58, 237, 0.1)',
            color: 'var(--mise-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChefHat size={18} />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: -0.2,
            color: 'var(--mise-text-primary)',
            fontFamily: 'var(--mise-font-display)',
          }}
        >
          {t('appName')}
        </div>
      </div>
      {right ?? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LangPill lang={profile.language} />
          <button
            type="button"
            aria-label={t('settings')}
            onClick={() => navigate('/settings')}
            className="press"
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 'var(--mise-radius-button)',
              border: '1px solid var(--mise-glass-border)',
              background: 'var(--mise-glass-fill)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              color: 'var(--mise-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              boxShadow: 'var(--mise-shadow-sm)',
              boxSizing: 'border-box',
            }}
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function LangPill({ lang }: { lang: 'EN' | 'EL' | 'ES' }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 11px',
        borderRadius: 'var(--mise-radius-pill)',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--mise-glass-border)',
        color: 'var(--mise-text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        boxShadow: 'var(--mise-shadow-sm)',
      }}
    >
      <Globe size={12} />
      {lang}
    </div>
  );
}

export function SubHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { t } = useApp();
  const handleBack = onBack ?? (() => navigate(-1));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px 10px',
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderBottom: '1px solid var(--mise-glass-border)',
      }}
    >
      <button
        aria-label={t('back')}
        type="button"
        onClick={handleBack}
        className="press"
        style={{
          minWidth: 44,
          minHeight: 44,
          borderRadius: 'var(--mise-radius-button)',
          border: '1px solid var(--mise-glass-border)',
          background: 'rgba(255,255,255,0.5)',
          color: 'var(--mise-text-primary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        <ArrowLeft size={18} />
      </button>
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: -0.3,
          color: 'var(--mise-text-primary)',
          fontFamily: 'var(--mise-font-display)',
        }}
      >
        {title}
      </div>
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

export function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: color ?? 'var(--mise-text-tertiary)',
        marginBottom: 12,
        fontFamily: 'var(--mise-font-text)',
      }}
    >
      {children}
    </div>
  );
}

/* ─── Bottom navigation ────────────────────────────────────────
 * Frosted glass bar, 4 tabs (Favorites lives inside History via
 * query param). Active state uses a soft purple pill background
 * matching the Figma mock.
 */
export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useApp();
  const reduceMotion = prefersReducedMotion();

  if (!TAB_ROUTES.includes(location.pathname)) return null;

  const tabs = [
    { path: '/', icon: Home, label: t('home') },
    { path: '/pantry', icon: Package, label: t('pantry') },
    { path: '/history', icon: Clock, label: t('history') },
    { path: '/profile', icon: User, label: t('profile') },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderTop: '1px solid var(--mise-glass-border)',
        paddingTop: 8,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        boxShadow: '0px -4px 24px rgba(0, 0, 0, 0.08)',
        zIndex: 100,
      }}
    >
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className="press"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 14px',
              border: 'none',
              borderRadius: 'var(--mise-radius-small)',
              background: active ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              cursor: 'pointer',
              color: active ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
              fontFamily: 'var(--mise-font-text)',
              ...(reduceMotion
                ? { transition: 'none' }
                : { transition: 'background-color 0.2s ease, color 0.2s ease' }),
            }}
          >
            <Icon size={22} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: active ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Glass card primitives (utility wrappers) ───────────────── */

export function GlassCard({
  children,
  style,
  className,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-card)',
        boxShadow: 'var(--mise-shadow-glass)',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
