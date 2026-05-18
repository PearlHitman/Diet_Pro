// Home — Mise Liquid Glass.
// Time-aware greeting, two glass CTA cards, optional API-key banner only.

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Refrigerator, Lightbulb, ChevronRight, AlertCircle } from 'lucide-react';
import { Screen, AppHeader } from '../components/Chrome';
import { useApp } from '../lib/app-state';

function greetingKey(): 'homeGreetingMorning' | 'homeGreetingAfternoon' | 'homeGreetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'homeGreetingMorning';
  if (h < 17) return 'homeGreetingAfternoon';
  return 'homeGreetingEvening';
}

export function HomePage() {
  const { pantry, profile, settings, t } = useApp();
  const navigate = useNavigate();

  const needsKey = !settings.apiKey;
  const pantryCount = pantry.length;
  const card1Enough = pantryCount >= 2;

  const gk = greetingKey();
  const greetLine =
    `${t(gk)}${profile.name.trim() ? `, ${profile.name.trim()}` : ''}`;

  return (
    <Screen>
      <AppHeader />

      <div style={{ padding: '8px 20px 28px' }}>
        <div className="fade-up" style={{ animationDelay: '0ms', marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              lineHeight: '40px',
              letterSpacing: -0.6,
              color: 'var(--mise-text-primary)',
              fontFamily: 'var(--mise-font-display)',
              marginBottom: 6,
            }}
          >
            {greetLine}
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: '24px',
              color: 'var(--mise-text-secondary)',
              fontFamily: 'var(--mise-font-text)',
              margin: 0,
            }}
          >
            {t('homeSubtitleWhatsCooking')}
          </p>
        </div>

        <div
          className="fade-up"
          style={{
            animationDelay: '60ms',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <CTACard
            icon={<Refrigerator size={24} style={{ color: 'var(--mise-primary)' }} />}
            title={t('cookFromPantry')}
            subtitle={
              card1Enough
                ? t('nIngredientsInPantry', { n: pantryCount })
                : t('pantryCardNeedMoreHint')
            }
            onClick={() => navigate(card1Enough ? '/generate' : '/pantry')}
          />
          <CTACard
            icon={<Lightbulb size={24} style={{ color: 'var(--mise-primary)' }} />}
            title={t('haveDishInMind')}
            subtitle={t('haveDishInMindSub')}
            onClick={() => navigate('/dish')}
          />
        </div>

        {needsKey && (
          <Link to="/settings" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div
              className="fade-up"
              style={{
                animationDelay: '120ms',
                padding: '14px 16px',
                background: 'rgba(245, 158, 11, 0.10)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--mise-radius-button)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--mise-text-primary)',
                fontSize: 14,
                boxShadow: 'var(--mise-shadow-sm)',
              }}
            >
              <AlertCircle size={18} style={{ color: 'var(--mise-warning)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t('errorNoKey')}</span>
              <ChevronRight size={16} style={{ color: 'var(--mise-warning)' }} />
            </div>
          </Link>
        )}
      </div>
    </Screen>
  );
}

function CTACard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 20,
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-card)',
        boxShadow: 'var(--mise-shadow-glass)',
        cursor: 'pointer',
        transition: 'transform 0.3s var(--mise-ease-apple), box-shadow 0.3s var(--mise-ease-apple)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'rgba(124, 58, 237, 0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            lineHeight: '24px',
            color: 'var(--mise-text-primary)',
            fontFamily: 'var(--mise-font-text)',
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: '20px',
            color: 'var(--mise-text-secondary)',
            fontFamily: 'var(--mise-font-text)',
          }}
        >
          {subtitle}
        </div>
      </div>
      <ChevronRight size={20} style={{ color: 'var(--mise-text-tertiary)', flexShrink: 0 }} />
    </button>
  );
}
