// Feed card components — used exclusively on the Home feed.
// Each variant is self-contained: it owns its layout but delegates
// colors/typography to T tokens and motion to animations.css classes.

import React, { useState } from 'react';
import { T } from '../tokens';
import type { MealOfDay, FoodFact, SeasonalPick } from '../lib/feed';

// ─── Generic shell ────────────────────────────────────────────────────────

interface FeedCardProps {
  badge: string;
  badgeColor?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
  index?: number;
}

export function FeedCard({
  badge,
  badgeColor = T.muted,
  onRefresh,
  refreshing,
  children,
  index = 0,
}: FeedCardProps) {
  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${index * 60}ms`,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Card header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 0',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
          textTransform: 'uppercase', color: badgeColor,
        }}>
          {badge}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            style={{
              background: 'transparent', border: 'none', padding: 4,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              color: T.muted, lineHeight: 1,
              display: 'flex', alignItems: 'center',
              opacity: refreshing ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <RefreshIcon size={14} spinning={refreshing} />
          </button>
        )}
      </div>
      <div style={{ padding: '8px 14px 14px' }}>{children}</div>
    </div>
  );
}

// ─── Skeleton placeholder (while network call is in-flight) ───────────────

export function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${index * 60}ms`,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
        padding: '10px 14px 14px',
      }}
    >
      <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 160, width: '100%', borderRadius: 10, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 7 }} />
      <div className="skeleton" style={{ height: 12, width: '50%' }} />
    </div>
  );
}

// ─── Recipe of the Day ───────────────────────────────────────────────────

interface RecipeOfDayCardProps {
  meal: MealOfDay | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  badge: string;
  viewLabel: string;
  index?: number;
}

export function RecipeOfDayCard({
  meal,
  loading,
  error,
  onRefresh,
  refreshing,
  badge,
  viewLabel,
  index = 0,
}: RecipeOfDayCardProps) {
  const [imgError, setImgError] = useState(false);

  if (loading) return <SkeletonCard index={index} />;

  if (error || !meal) {
    return (
      <FeedCard badge={badge} badgeColor={T.accent} onRefresh={onRefresh} refreshing={refreshing} index={index}>
        <div style={{
          padding: '18px 0', textAlign: 'center',
          color: T.muted, fontSize: 13,
        }}>
          Could not load recipe · tap refresh to try again
        </div>
      </FeedCard>
    );
  }

  return (
    <FeedCard badge={badge} badgeColor={T.accent} onRefresh={onRefresh} refreshing={refreshing} index={index}>
      {/* Meal image */}
      {meal.thumb && !imgError && (
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          <img
            src={meal.thumb}
            alt={meal.name}
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: 180,
              objectFit: 'cover', display: 'block',
            }}
          />
        </div>
      )}

      {/* Name */}
      <div style={{
        fontSize: 17, fontWeight: 700, color: T.text,
        letterSpacing: -0.4, lineHeight: 1.25, marginBottom: 8,
      }}>
        {meal.name}
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {meal.category && <Chip label={meal.category} />}
        {meal.area && <Chip label={meal.area} />}
        {meal.tags.slice(0, 2).map(tag => (
          <Chip key={tag} label={tag} />
        ))}
      </div>

      {/* CTA links */}
      <div style={{ display: 'flex', gap: 10 }}>
        <a
          href={`https://www.themealdb.com/meal/${meal.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, textAlign: 'center',
            padding: '9px 12px',
            background: T.accentTint, border: `1px solid ${T.borderAcc}`,
            borderRadius: 10, color: T.accent,
            fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {viewLabel} <ExternalLinkIcon size={12} />
        </a>
        {meal.youtubeUrl && (
          <a
            href={meal.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Watch on YouTube"
            style={{
              padding: '9px 12px',
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, color: T.muted,
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <YoutubeIcon size={16} />
          </a>
        )}
      </div>
    </FeedCard>
  );
}

// ─── Food Fact ────────────────────────────────────────────────────────────

interface FactCardProps {
  fact: FoodFact;
  badge: string;
  index?: number;
}

export function FactCard({ fact, badge, index = 0 }: FactCardProps) {
  return (
    <FeedCard badge={badge} badgeColor={T.success} index={index}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          fontSize: 28, lineHeight: 1, flexShrink: 0,
          marginTop: 2,
        }}>
          {fact.icon}
        </div>
        <div style={{
          fontSize: 14, lineHeight: 1.55, color: T.text,
          fontStyle: 'italic',
          letterSpacing: 0.1,
        }}>
          "{fact.text}"
        </div>
      </div>
    </FeedCard>
  );
}

// ─── Seasonal Spotlight ───────────────────────────────────────────────────

interface SeasonalCardProps {
  season: string;
  picks: SeasonalPick[];
  badge: string;
  seasonLabel: string;
  index?: number;
}

export function SeasonalCard({ season, picks, badge, seasonLabel, index = 0 }: SeasonalCardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <FeedCard badge={badge} badgeColor={T.warning} index={index}>
      <div style={{
        fontSize: 13, color: T.text2, marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{seasonLabel}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 999,
          background: T.warnTint, border: `1px solid ${T.warnBord}`,
          color: T.warning, fontSize: 11, fontWeight: 600,
        }}>
          {season}
        </span>
      </div>

      {/* Horizontal scroll row of ingredient pills */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 6,
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}>
        {picks.map((pick, i) => (
          <button
            key={pick.name}
            onClick={() => setSelected(selected === i ? null : i)}
            className="press"
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px',
              background: selected === i ? T.warnTint : T.surfaceHi,
              border: `1px solid ${selected === i ? T.warnBord : T.border}`,
              borderRadius: 999,
              color: selected === i ? T.warning : T.text2,
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: T.font,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{pick.emoji}</span>
            {pick.name}
          </button>
        ))}
      </div>

      {/* Expandable note */}
      {selected !== null && picks[selected] && (
        <div
          className="fade-up"
          style={{
            marginTop: 10,
            padding: '9px 12px',
            background: T.warnTint, border: `1px solid ${T.warnBord}`,
            borderRadius: 10,
            fontSize: 12.5, color: T.text2, lineHeight: 1.45,
          }}
        >
          <strong style={{ color: T.warning }}>{picks[selected].emoji} {picks[selected].name}</strong>
          {' — '}
          {picks[selected].note}
        </div>
      )}
    </FeedCard>
  );
}

// ─── Small helper components ──────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      padding: '3px 9px',
      background: T.surfaceHi, border: `1px solid ${T.border}`,
      borderRadius: 999, color: T.text2,
      fontSize: 11, fontWeight: 500,
    }}>
      {label}
    </span>
  );
}

function RefreshIcon({ size, spinning }: { size: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={spinning ? { animation: 'spin 0.7s linear infinite' } : undefined}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function ExternalLinkIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function YoutubeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}
