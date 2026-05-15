// Form primitives, adapted from screens-pantry.jsx but now functional
// (FakeInput → Input, Segmented & Stepper take onChange).

import React from 'react';
import { T } from '../tokens';

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
        textTransform: 'uppercase', color: T.muted, marginBottom: 8,
      }}>{label}</div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: T.mute2, marginTop: 6, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Input({
  value, onChange, placeholder, type = 'text', autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'password';
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%',
        padding: '12px 14px',
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 11,
        color: T.text,
        fontSize: 15,
        fontFamily: T.font,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

export function Segmented<V extends string>({
  options, value, onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      padding: 4, gap: 2,
      borderRadius: 11,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${T.border}`,
    }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: active ? `1px solid ${T.borderAcc}` : '1px solid transparent',
              background: active ? T.accentTint : 'transparent',
              color: active ? T.accent : T.text2,
              fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
              fontFamily: T.font, cursor: 'pointer',
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value, onChange, min = 1, max = 12,
}: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      padding: 4, gap: 2,
      borderRadius: 11,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${T.border}`,
      width: 140,
    }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: 'none', background: 'rgba(255,255,255,0.04)', color: T.text,
          cursor: 'pointer', fontSize: 18, fontFamily: T.font,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >−</button>
      <div style={{
        flex: 1, textAlign: 'center',
        fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: 'none', background: T.accentTint, color: T.accent,
          cursor: 'pointer', fontSize: 18, fontFamily: T.font,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>
    </div>
  );
}

export function PrimaryButton({
  children, onClick, disabled, fullWidth, icon, className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '14px 22px',
        background: disabled ? T.surface : T.accentGrad,
        color: disabled ? T.muted : '#1a1208',
        border: 'none',
        borderRadius: 14,
        fontSize: 15, fontWeight: 700, fontFamily: T.font,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        letterSpacing: -0.2,
      }}
    >
      {icon}{children}
    </button>
  );
}

export function GhostButton({
  children, onClick, fullWidth, icon,
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
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '13px 16px',
        background: T.surface,
        color: T.text2,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {icon}{children}
    </button>
  );
}
