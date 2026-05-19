// Cook Mode — Option B "Scroll + Lock" layout.
//
// Completed steps  → collapsed single line, strikethrough, faded
// Active step      → large hero card ("Now cooking")
// Future steps     → small, dimmed preview
// Sticky timer     → banner below header when a timer is running
//
// Rendered OUTSIDE page-enter (see App.tsx) so position:fixed works
// correctly on iOS Safari (no ancestor transform creates a containing block).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-state';

// ─── Speech API types (not in every TS lib) ─────────────────

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror:  ((e: Event) => void) | null;
  onend:    (() => void) | null;
}
interface ISpeechRecognitionResult { readonly 0: { transcript: string } }
interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { length: number; [i: number]: ISpeechRecognitionResult };
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

// ─── Timer types ─────────────────────────────────────────────

interface TimerState { total: number; remaining: number; running: boolean }

// ─── Helpers ─────────────────────────────────────────────────

function parseTimerSeconds(text: string): number {
  const hr  = text.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/i);
  const min = text.match(/(\d+(?:\.\d+)?)\s*(?:minute|min)/i);
  const sec = text.match(/(\d+(?:\.\d+)?)\s*(?:second|sec)/i);
  let t = 0;
  if (hr)  t += parseFloat(hr[1])  * 3600;
  if (min) t += parseFloat(min[1]) * 60;
  if (sec) t += parseFloat(sec[1]);
  return Math.round(t);
}

function fmt(secs: number) {
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
}

/** Highlight time mentions in amber. */
function HighStep({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?))/gi);
  return (
    <>
      {parts.map((p, i) =>
        /\d/.test(p) && /min|sec|hour|hr/i.test(p)
          ? <span key={i} style={{ color: '#F59E0B', fontWeight: 700 }}>{p}</span>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

// ─── Component ───────────────────────────────────────────────

export function CookModePage() {
  const { id }      = useParams<{ id: string }>();
  const { recipes, t, profile } = useApp();
  const navigate    = useNavigate();
  const recipe      = recipes.find(r => r.id === id);

  const [stepIdx, setStepIdx] = useState(0);
  const [timers,  setTimers]  = useState<Record<number, TimerState>>({});
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const wakeLockRef    = useRef<WakeLockSentinel | null>(null);
  const activeRef      = useRef<HTMLDivElement | null>(null);

  const steps      = recipe?.steps ?? [];
  const totalSteps = steps.length;
  const done       = stepIdx >= totalSteps - 1;

  // ── Wake lock ───────────────────────────────────────────────
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(l => { wakeLockRef.current = l; })
        .catch(() => {});
    }
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, []);

  // ── Init timer for step ─────────────────────────────────────
  useEffect(() => {
    if (!steps[stepIdx] || timers[stepIdx] !== undefined) return;
    const secs = parseTimerSeconds(steps[stepIdx]);
    if (secs > 0)
      setTimers(p => ({ ...p, [stepIdx]: { total: secs, remaining: secs, running: false } }));
  }, [stepIdx, steps]);

  // ── Timer tick ──────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!timers[stepIdx]?.running) return;
    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        const cur = prev[stepIdx];
        if (!cur?.running) return prev;
        if (cur.remaining <= 1) {
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const g   = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.frequency.value = 880;
            g.gain.setValueAtTime(0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc.start(); osc.stop(ctx.currentTime + 0.8);
          } catch (_) {}
          return { ...prev, [stepIdx]: { ...cur, remaining: 0, running: false } };
        }
        return { ...prev, [stepIdx]: { ...cur, remaining: cur.remaining - 1 } };
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timers, stepIdx]);

  // ── Toggle timer ────────────────────────────────────────────
  const toggleTimer = useCallback(() => {
    setTimers(prev => {
      const cur = prev[stepIdx];
      if (!cur) return prev;
      if (cur.remaining === 0)
        return { ...prev, [stepIdx]: { ...cur, remaining: cur.total, running: true } };
      return { ...prev, [stepIdx]: { ...cur, running: !cur.running } };
    });
  }, [stepIdx]);

  // ── Voice ───────────────────────────────────────────────────
  const [voiceOn, setVoiceOn] = useState(false);

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = profile.language === 'EL' ? 'el-GR' : profile.language === 'ES' ? 'es-ES' : 'en-US';
    rec.onresult = (e: ISpeechRecognitionEvent) => {
      const parts: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++)
        parts.push(e.results[i][0].transcript.toLowerCase());
      if (/\b(next|siguiente|\u03b5\u03c0\u03cc\u03bc\u03b5\u03bd\u03bf)\b/.test(parts.join(' ')))
        setStepIdx(p => Math.min(p + 1, totalSteps - 1));
    };
    rec.onerror = () => setVoiceOn(false);
    rec.onend   = () => setVoiceOn(false);
    recognitionRef.current = rec;
    rec.start();
    setVoiceOn(true);
  }, [profile.language, totalSteps]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceOn(false);
  }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ── Advance & scroll active step into view ──────────────────
  const goNext = useCallback(() => {
    setStepIdx(i => Math.min(i + 1, totalSteps - 1));
  }, [totalSteps]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepIdx]);

  // ── No recipe guard ─────────────────────────────────────────
  if (!recipe) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--mise-background)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mise-font-text)',
      }}>
        <button onClick={() => navigate(-1)}
          style={{ padding: '12px 28px', borderRadius: 999,
            background: 'var(--mise-primary)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
          ← Back
        </button>
      </div>
    );
  }

  const timer = timers[stepIdx];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr auto',
      background: 'var(--mise-background)',
      fontFamily: 'var(--mise-font-text)',
      paddingTop:    'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft:   'env(safe-area-inset-left)',
      paddingRight:  'env(safe-area-inset-right)',
    }}>

      {/* ── ROW 1: Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        borderBottom: '1px solid var(--mise-glass-border)',
        background: 'var(--mise-surface)',
      }}>
        <button onClick={() => navigate(-1)}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--mise-glass-border)',
            background: 'transparent',
            color: 'var(--mise-text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>‹</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--mise-text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{recipe.name}</div>
          <div style={{ fontSize: 11, color: 'var(--mise-text-secondary)', marginTop: 1 }}>
            {t('stepOf', { current: stepIdx + 1, total: totalSteps })}
          </div>
        </div>

        {/* Mic toggle */}
        <button onClick={voiceOn ? stopVoice : startVoice}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            border: voiceOn ? '2px solid var(--mise-primary)' : '1px solid var(--mise-glass-border)',
            background: voiceOn ? 'rgba(124,58,237,0.12)' : 'transparent',
            color: voiceOn ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
            cursor: 'pointer', fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: voiceOn ? 'micPulse 1.4s ease-in-out infinite' : 'none',
          }}>🎤</button>
      </div>

      {/* ── ROW 2: Sticky timer banner (only when timer exists for this step) ── */}
      {timer && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: timer.remaining === 0
            ? 'rgba(16,185,129,0.12)'
            : timer.running
              ? 'rgba(124,58,237,0.10)'
              : 'var(--mise-glass-elevated)',
          borderBottom: '1px solid var(--mise-glass-border)',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mise-text-secondary)', marginBottom: 2 }}>
              {timer.remaining === 0
                ? '✓ Timer done'
                : timer.running
                  ? `Running — step ${stepIdx + 1}`
                  : `Timer — step ${stepIdx + 1}`}
            </div>
            {/* Progress bar */}
            <div style={{
              width: 120, height: 3, borderRadius: 2,
              background: 'var(--mise-glass-border)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: timer.remaining === 0 ? '#10B981' : 'var(--mise-primary)',
                width: `${((timer.total - timer.remaining) / timer.total) * 100}%`,
                transition: 'width 1s linear',
              }} />
            </div>
          </div>

          <div style={{
            fontSize: 26, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: timer.remaining === 0 ? '#10B981' : 'var(--mise-text-primary)',
            letterSpacing: -1,
          }}>
            {timer.remaining === 0 ? 'Done!' : fmt(timer.remaining)}
          </div>

          <button onClick={toggleTimer}
            style={{
              padding: '8px 16px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: timer.remaining === 0
                ? 'rgba(16,185,129,0.15)'
                : timer.running
                  ? 'var(--mise-glass-border)'
                  : 'var(--mise-primary)',
              color: timer.remaining === 0
                ? '#10B981'
                : timer.running
                  ? 'var(--mise-text-primary)'
                  : '#fff',
            }}>
            {timer.remaining === 0
              ? t('timerDone')
              : timer.running
                ? t('timerPause')
                : timer.remaining === timer.total
                  ? t('timerStart')
                  : t('timerResume')}
          </button>
        </div>
      )}

      {/* ── ROW 3: Step list ── */}
      <div style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        padding: '12px 16px 8px',
      }}>
        {steps.map((step, i) => {
          const isDone    = i < stepIdx;
          const isActive  = i === stepIdx;
          const isFuture  = i > stepIdx;

          // ── Completed step: one-line strikethrough ──────────
          if (isDone) {
            return (
              <div key={i}
                onClick={() => setStepIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 4px',
                  cursor: 'pointer',
                  opacity: 0.38,
                  borderBottom: '1px solid var(--mise-glass-border)',
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
                  background: 'var(--mise-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff', fontWeight: 700,
                }}>✓</div>
                <div style={{
                  fontSize: 13, color: 'var(--mise-text-primary)',
                  textDecoration: 'line-through',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  flex: 1,
                }}>{step}</div>
              </div>
            );
          }

          // ── Active step: big hero card ──────────────────────
          if (isActive) {
            return (
              <div key={i} ref={activeRef}
                style={{
                  borderRadius: 18,
                  border: '2px solid var(--mise-primary)',
                  background: 'rgba(124,58,237,0.07)',
                  padding: '18px 16px',
                  margin: '10px 0',
                  boxShadow: '0 6px 24px rgba(124,58,237,0.18)',
                }}>
                {/* "Now cooking" label */}
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
                  color: 'var(--mise-primary)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>{t('nowCooking')}</div>

                {/* Step number */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'var(--mise-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#fff',
                  marginBottom: 12,
                }}>{i + 1}</div>

                {/* Step text */}
                <div style={{
                  fontSize: 16, lineHeight: 1.65,
                  color: 'var(--mise-text-primary)', fontWeight: 500,
                }}>
                  <HighStep text={step} />
                </div>
              </div>
            );
          }

          // ── Future step: small dimmed preview ───────────────
          return (
            <div key={i}
              onClick={() => setStepIdx(i)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 4px',
                cursor: 'pointer',
                opacity: 0.55,
                borderBottom: i < steps.length - 1 ? '1px solid var(--mise-glass-border)' : 'none',
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
                border: '1.5px solid var(--mise-glass-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--mise-text-secondary)', fontWeight: 700,
                marginTop: 1,
              }}>{i + 1}</div>
              <div style={{
                fontSize: 13, lineHeight: 1.5,
                color: 'var(--mise-text-primary)',
                // show at most 2 lines
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{step}</div>
            </div>
          );
        })}

        {/* Completion message */}
        {done && stepIdx === totalSteps - 1 && (
          <div style={{
            textAlign: 'center',
            padding: '28px 16px',
            marginTop: 8,
            borderRadius: 16,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--mise-text-primary)', marginBottom: 6 }}>
              {t('cookComplete')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mise-text-secondary)' }}>
              {t('cookCompleteHint')}
            </div>
          </div>
        )}

        <div style={{ height: 12 }} />
      </div>

      {/* ── ROW 4: Footer ── */}
      <div style={{
        borderTop: '1px solid var(--mise-glass-border)',
        background: 'var(--mise-surface)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={() => setStepIdx(i => Math.max(i - 1, 0))}
          disabled={stepIdx === 0}
          style={{
            width: 44, height: 52, borderRadius: 12, flexShrink: 0,
            border: '1px solid var(--mise-glass-border)',
            background: 'transparent',
            color: stepIdx === 0 ? 'var(--mise-glass-border)' : 'var(--mise-text-primary)',
            cursor: stepIdx === 0 ? 'default' : 'pointer',
            fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>

        <button onClick={done ? () => navigate(-1) : goNext}
          className="press"
          style={{
            flex: 1, height: 52,
            borderRadius: 'var(--mise-radius-button)',
            border: 'none',
            background: done ? '#10B981' : 'var(--mise-primary)',
            color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--mise-font-text)',
            boxShadow: done
              ? '0 4px 12px rgba(16,185,129,0.3)'
              : '0 4px 12px rgba(124,58,237,0.3)',
          }}>
          {done ? `🎉 ${t('cookComplete')}` : t('markDoneNext')}
        </button>
      </div>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(124,58,237,0); }
        }
      `}</style>
    </div>
  );
}
