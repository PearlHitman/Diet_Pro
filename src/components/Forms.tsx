// Form primitives — Mise Liquid Glass.
// Light glass inputs, purple-accented active/pressed states, larger
// touch targets and SF Pro typography per Guidelines.md.

import React from 'react';
import { prefersReducedMotion } from '../lib/motion';
import { T } from '../tokens';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: T.fontSize.small,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: 'var(--mise-text-tertiary)',
          marginBottom: 10,
          fontFamily: 'var(--mise-font-text)',
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div
          style={{
            fontSize: T.fontSize.caption,
            color: 'var(--mise-text-tertiary)',
            marginTop: 8,
            lineHeight: 1.5,
            fontFamily: 'var(--mise-font-text)',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'password';
  autoFocus?: boolean;
}) {
  const reduceMotion = prefersReducedMotion();
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-input)',
        color: 'var(--mise-text-primary)',
        fontSize: T.fontSize.bodyLg,
        fontFamily: 'var(--mise-font-text)',
        outline: 'none',
        boxSizing: 'border-box',
        boxShadow: 'var(--mise-shadow-sm)',
        ...(reduceMotion ? { transition: 'none' } : { transition: 'border-color 0.2s, box-shadow 0.2s' }),
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--mise-primary)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--mise-glass-border)';
        e.currentTarget.style.boxShadow = 'var(--mise-shadow-sm)';
      }}
    />
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const reduceMotion = prefersReducedMotion();
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        gap: 2,
        borderRadius: 'var(--mise-radius-button)',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--mise-glass-border)',
        boxShadow: 'var(--mise-shadow-sm)',
      }}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="press"
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'none',
              background: active ? 'var(--mise-primary)' : 'transparent',
              color: active ? 'var(--mise-text-on-primary)' : 'var(--mise-text-secondary)',
              fontSize: T.fontSize.small,
              fontWeight: 600,
              letterSpacing: -0.1,
              fontFamily: 'var(--mise-font-text)',
              cursor: 'pointer',
              ...(reduceMotion ? { transition: 'none' } : { transition: 'background 0.2s, color 0.2s' }),
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 4,
        gap: 2,
        borderRadius: 'var(--mise-radius-button)',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--mise-glass-border)',
        width: 152,
        boxShadow: 'var(--mise-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="press"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: 'none',
          background: 'transparent',
          color: 'var(--mise-text-primary)',
          cursor: 'pointer',
          fontSize: T.fontSize.h2,
          fontFamily: 'var(--mise-font-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        −
      </button>
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: T.fontSize.lead,
          fontWeight: 600,
          color: 'var(--mise-text-primary)',
          letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="press"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: 'none',
          background: 'rgba(124, 58, 237, 0.10)',
          color: 'var(--mise-primary)',
          cursor: 'pointer',
          fontSize: T.fontSize.h2,
          fontFamily: 'var(--mise-font-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  fullWidth,
  icon,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = prefersReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`press-soft ${className ?? ''}`}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '14px 24px',
        background: disabled ? 'var(--mise-glass-fill)' : 'var(--mise-primary)',
        color: disabled ? 'var(--mise-text-tertiary)' : '#FFFFFF',
        border: disabled ? '1px solid var(--mise-glass-border)' : 'none',
        borderRadius: 'var(--mise-radius-button)',
        fontSize: T.fontSize.bodyLg,
        fontWeight: 600,
        fontFamily: 'var(--mise-font-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: -0.1,
        boxShadow: disabled ? 'none' : '0px 4px 12px rgba(124, 58, 237, 0.3)',
        ...(reduceMotion
          ? { transition: 'none' }
          : { transition: 'transform 0.12s, box-shadow 0.2s, background 0.2s' }),
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  fullWidth,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '13px 18px',
        background: 'var(--mise-glass-fill)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color: 'var(--mise-primary)',
        border: '1px solid var(--mise-glass-border)',
        borderRadius: 'var(--mise-radius-button)',
        fontSize: T.fontSize.body,
        fontWeight: 600,
        fontFamily: 'var(--mise-font-text)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: 'var(--mise-shadow-sm)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
