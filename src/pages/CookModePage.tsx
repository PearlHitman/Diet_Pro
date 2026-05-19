// Cook Mode — full-screen step-by-step cooking view.
// Architecture notes:
//   - Rendered OUTSIDE the page-enter div (see App.tsx) so position:fixed
//     works correctly on iOS Safari (no ancestor transform creates a new
//     containing block).
//   - Shell uses display:grid / gridTemplateRows:'auto 1fr auto' which is
//     more reliable than flex+minHeight:0 on older WebKit for scroll regions.
//   - WakeLock keeps the screen on while cooking.
//   - Web Speech API listens for "next" / "siguiente" / "epomeno" to advance.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-state';

// ─── Types ────────────────────────────────────────────────────

interface TimerState {
  total: number;      // seconds
  remaining: number;
  running: boolean;
}

// Web Speech API — not in every TS lib, so declare minimally here.
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
interface ISpeechRecognitionResult {
  readonly 0: { transcript: string };
}
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

// ─── Helpers ─────────────────────────────────────────────────

/** Extract the first timer mentioned in a step string (returns seconds, or 0). */
function parseTimerSeconds(text: string): number {
  // Match patterns like "5 minutes", "30 seconds", "1.5 hours", "2 hrs"
  const min = text.match(/(\d+(?:\.\d+)?)\s*(?:minute|min|минут)/i);
  const sec = text.match(/(\d+(?:\.\d+)?)\s*(?:second|sec|сек)/i);
  const hr  = text.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|час)/i);
  let total = 0;
  if (hr)  total += parseFloat(hr[1])  * 3600;
  if (min) total += parseFloat(min[1]) * 60;
  if (sec) total += parseFloat(sec[1]);
  return Math.round(total);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Wrap time references in the step text in an amber <span>. */
function HighlightedStep({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?))/gi);
  return (
    <>
      {parts.map((part, i) =>
        /\d+(?:\.\d+)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?)/i.test(part)
          ? <span key={i} style={{ color: '#F59E0B', fontWeight: 700 }}>{part}</span>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const { recipes, t, profile } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);

  // Current step index
  const [stepIdx, setStepIdx] = useState(0);

  // Timer per step (lazy-init)
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice
  const [voiceActive, setVoiceActive] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Wake lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const steps: string[] = recipe?.steps ?? [];
  const totalSteps = steps.length;

  // ─── Wake lock ─────────────────────────────────────────────
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock; })
        .catch(() => {/* not supported or denied — silently ignore */});
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // ─── Timer tick ────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const running = timers[stepIdx];
    if (!running?.running) return;
    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        const cur = prev[stepIdx];
        if (!cur || !cur.running) return prev;
        const next = cur.remaining - 1;
        if (next <= 0) {
          // Done — stop and play a soft beep via AudioContext
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
          } catch (_) {/* ignore */}
          return { ...prev, [stepIdx]: { ...cur, remaining: 0, running: false } };
        }
        return { ...prev, [stepIdx]: { ...cur, remaining: next } };
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timers, stepIdx]);

  // ─── Init timer for current step ──────────────────────────
  useEffect(() => {
    if (!steps[stepIdx]) return;
    if (timers[stepIdx] !== undefined) return;
    const secs = parseTimerSeconds(steps[stepIdx]);
    if (secs > 0) {
      setTimers(prev => ({ ...prev, [stepIdx]: { total: secs, remaining: secs, running: false } }));
    }
  }, [stepIdx, steps]);

  // ─── Voice recognition ─────────────────────────────────────
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const rec: ISpeechRecognition = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = profile.language === 'EL' ? 'el-GR' : profile.language === 'ES' ? 'es-ES' : 'en-US';
    rec.onresult = (e: ISpeechRecognitionEvent) => {
      const transcripts: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcripts.push(e.results[i][0].transcript.toLowerCase());
      }
      const transcript = transcripts.join(' ');
      if (/\b(next|siguiente|\u03b5\u03c0\u03cc\u03bc\u03b5\u03bd\u03bf)\b/.test(transcript)) {
        setStepIdx(prev => Math.min(prev + 1, totalSteps - 1));
      }
    };
    rec.onerror = () => { setVoiceActive(false); };
    rec.onend   = () => { setVoiceActive(false); };
    recognitionRef.current = rec;
    rec.start();
    setVoiceActive(true);
  }, [profile.language, totalSteps]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceActive(false);
  }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ─── Navigation ────────────────────────────────────────────
  const goNext = useCallback(() => setStepIdx(i => Math.min(i + 1, totalSteps - 1)), [totalSteps]);
  const goPrev = useCallback(() => setStepIdx(i => Math.max(i - 1, 0)), []);
  const done = stepIdx >= totalSteps - 1;

  // ─── Timer controls ────────────────────────────────────────
  const toggleTimer = useCallback(() => {
    setTimers(prev => {
      const cur = prev[stepIdx];
      if (!cur) return prev;
      if (cur.remaining === 0) {
        // Restart
        return { ...prev, [stepIdx]: { ...cur, remaining: cur.total, running: true } };
      }
      return { ...prev, [stepIdx]: { ...cur, running: !cur.running } };
    });
  }, [stepIdx]);

  // ─── No recipe guard ───────────────────────────────────────
  if (!recipe) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--mise-bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mise-font-text)', color: 'var(--mise-text)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🍳</div>
          <div style={{ fontSize: 16, marginBottom: 20 }}>Recipe not found</div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 24px', borderRadius: 999,
              background: 'var(--mise-primary)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >Go back</button>
        </div>
      </div>
    );
  }

  const timer = timers[stepIdx];

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={{
      // Fill the full viewport — position:fixed avoids being affected by
      // any ancestor scroll or transform (see App.tsx comment).
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 200,
      // Grid shell: header row / scrollable content / footer
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      background: 'var(--mise-bg)',
      fontFamily: 'var(--mise-font-text)',
      // Respect safe-areas on notched phones
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>

      {/* ── ROW 1: Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--mise-border)',
        background: 'var(--mise-surface)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          aria-label={t('exitCook')}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--mise-border)',
            background: 'var(--mise-surface2)',
            color: 'var(--mise-text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}
        >‹</button>

        <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: 'var(--mise-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {recipe.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mise-muted)', marginTop: 2 }}>
            {t('stepOf', { current: stepIdx + 1, total: totalSteps })}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              aria-label={`Step ${i + 1}`}
              style={{
                width: i === stepIdx ? 18 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: i === stepIdx
                  ? 'var(--mise-primary)'
                  : i < stepIdx
                    ? 'var(--mise-primary-muted, rgba(124,58,237,0.35))'
                    : 'var(--mise-border)',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── ROW 2: Scrollable step list ── */}
      <div style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        // minHeight:0 is the key on Chrome/FF; grid 1fr already handles WebKit
        minHeight: 0,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {steps.map((step, i) => {
          const isActive  = i === stepIdx;
          const isDone    = i < stepIdx;
          return (
            <div
              key={i}
              onClick={() => setStepIdx(i)}
              style={{
                borderRadius: 16,
                padding: '16px',
                cursor: 'pointer',
                border: isActive
                  ? '2px solid var(--mise-primary)'
                  : '1px solid var(--mise-border)',
                background: isActive
                  ? 'var(--mise-accent-tint, rgba(124,58,237,0.08))'
                  : isDone
                    ? 'var(--mise-surface2)'
                    : 'var(--mise-surface)',
                opacity: isDone ? 0.55 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 16px rgba(124,58,237,0.15)' : 'none',
              }}
            >
              {/* Step number badge */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9999,
                  background: isDone
                    ? 'var(--mise-primary)'
                    : isActive
                      ? 'var(--mise-primary)'
                      : 'var(--mise-border)',
                  color: isDone || isActive ? '#fff' : 'var(--mise-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 15, lineHeight: 1.6,
                  color: isActive ? 'var(--mise-text)' : 'var(--mise-muted)',
                  fontWeight: isActive ? 500 : 400,
                  flex: 1,
                }}>
                  {isActive
                    ? <HighlightedStep text={step} />
                    : step
                  }
                </div>
              </div>

              {/* Timer bar (only for active step with a detected timer) */}
              {isActive && timer && (
                <div style={{ marginTop: 14 }}>
                  {/* Progress bar */}
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: 'var(--mise-border)',
                    marginBottom: 10, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 2,
                      background: timer.remaining === 0
                        ? '#10B981'
                        : 'var(--mise-primary)',
                      width: `${((timer.total - timer.remaining) / timer.total) * 100}%`,
                      transition: 'width 1s linear',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontSize: 22, fontWeight: 700,
                      color: timer.remaining === 0 ? '#10B981' : 'var(--mise-text)',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: -0.5,
                    }}>
                      {timer.remaining === 0 ? '✓ Done' : formatTime(timer.remaining)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleTimer(); }}
                      style={{
                        padding: '8px 18px', borderRadius: 999,
                        border: 'none',
                        background: timer.remaining === 0
                          ? 'rgba(16,185,129,0.15)'
                          : timer.running
                            ? 'rgba(124,58,237,0.15)'
                            : 'var(--mise-primary)',
                        color: timer.remaining === 0
                          ? '#10B981'
                          : timer.running
                            ? 'var(--mise-primary)'
                            : '#fff',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {timer.remaining === 0
                        ? t('timerDone')
                        : timer.running
                          ? t('timerPause')
                          : timer.remaining === timer.total
                            ? t('timerStart')
                            : t('timerResume')
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Completion card */}
        {done && (
          <div style={{
            borderRadius: 16,
            padding: '24px 16px',
            textAlign: 'center',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            marginTop: 8,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{
              fontSize: 17, fontWeight: 700,
              color: 'var(--mise-text)', marginBottom: 6,
            }}>
              {t('cookComplete')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mise-muted)' }}>
              {t('cookCompleteHint')}
            </div>
          </div>
        )}

        {/* Bottom padding so last step isn't hidden behind footer */}
        <div style={{ height: 8 }} />
      </div>

      {/* ── ROW 3: Footer ── */}
      <div style={{
        borderTop: '1px solid var(--mise-border)',
        background: 'var(--mise-surface)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button
          onClick={goPrev}
          disabled={stepIdx === 0}
          aria-label="Previous step"
          style={{
            width: 44, height: 44, borderRadius: 12,
            border: '1px solid var(--mise-border)',
            background: 'var(--mise-surface2)',
            color: stepIdx === 0 ? 'var(--mise-border)' : 'var(--mise-text)',
            cursor: stepIdx === 0 ? 'default' : 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >‹</button>

        {/* Main CTA */}
        <button
          onClick={done ? () => navigate(-1) : goNext}
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
            transition: 'background 0.2s ease',
          }}
        >
          {done ? t('cookComplete') : t('markDoneNext')}
        </button>

        {/* Mic button */}
        <button
          onClick={voiceActive ? stopVoice : startVoice}
          aria-label={t('voiceHint')}
          style={{
            width: 44, height: 44, borderRadius: 12,
            border: voiceActive
              ? '2px solid var(--mise-primary)'
              : '1px solid var(--mise-border)',
            background: voiceActive
              ? 'rgba(124,58,237,0.12)'
              : 'var(--mise-surface2)',
            color: voiceActive ? 'var(--mise-primary)' : 'var(--mise-muted)',
            cursor: 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            animation: voiceActive ? 'micPulse 1.4s ease-in-out infinite' : 'none',
          }}
        >
          🎤
        </button>
      </div>

      {/* Mic pulse animation */}
      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(124,58,237,0); }
        }
      `}</style>
    </div>
  );
}
