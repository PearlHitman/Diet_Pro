// Shared screen chrome — Mise Liquid Glass aesthetic.
// Light/dark via theme.css; safe-area aware for real PWA on iOS.

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, Home, Package, Clock, User, ArrowLeft, Globe, Settings as SettingsIcon } from 'lucide-react';
import { T } from '../tokens';
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
        /* 100dvh: respects Safari's collapsible URL bar on iPhone */
        minHeight: '100dvh',
        background: bg ?? 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        paddingTop: SCREEN_PAD_TOP,
        /* Extra bottom padding clears the 72px tab bar + home indicator */
        paddingBottom: hasTabBar
          ? 'calc(72px + env(safe-area-inset-bottom) + 8px)'
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
        padding: dense ? '10px 18px 6px' : '14px 18px 10px',
      }}
    >
      {/* Mise wordmark + gradient chef-hat tile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--primary), #c8623a)',
            boxShadow: '0 6px 18px var(--primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ChefHat size={18} color="#fff" />
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: '-0.5px',
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1,
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
              borderRadius: 'var(--radius-button)',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              boxShadow: 'var(--shadow-sm)',
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
        borderRadius: 'var(--radius-pill)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--text-2)',
        fontSize: T.fontSize.tiny,
        fontWeight: 600,
        letterSpacing: 0.3,
        boxShadow: 'var(--shadow-sm)',
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
        background: 'var(--bg)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        borderBottom: '1px solid var(--border)',
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
          borderRadius: 'var(--radius-button)',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
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
          fontSize: T.fontSize.lead,
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
        fontSize: T.fontSize.small,
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
        height: 'calc(72px + env(safe-area-inset-bottom))',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: 8,
        paddingBottom: 'env(safe-area-inset-bottom)',
        /* Warm dark frosted dock */
        background: 'var(--surface)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -1px 0 var(--border-strong)',
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
              gap: 3,
              /* Minimum 44pt touch target */
              minWidth: 64,
              minHeight: 44,
              padding: '6px 10px',
              border: 'none',
              borderRadius: 'var(--radius-small)',
              background: active ? 'var(--primary-dim)' : 'transparent',
              cursor: 'pointer',
              color: active ? 'var(--primary)' : 'var(--text-3)',
              fontFamily: 'var(--font-sans)',
              ...(reduceMotion
                ? { transition: 'none' }
                : { transition: 'background-color 240ms var(--ease-mise), color 240ms var(--ease-mise)' }),
            }}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.6} />
            <span
              style={{
                fontSize: T.fontSize.tiny,
                fontWeight: active ? 600 : 400,
                color: 'inherit',
                lineHeight: 1,
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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
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
