// Full-screen guided cooking — scroll + lock layout.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Mic } from 'lucide-react';
import { useApp } from '../lib/app-state';

const TIME_REGEX = /(\d+)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;

interface TimerState {
  total: number;
  remaining: number;
  running: boolean;
}

function parseTimerSeconds(text: string): number | null {
  TIME_REGEX.lastIndex = 0;
  const m = TIME_REGEX.exec(text);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (/hour|hr/.test(unit)) return n * 3600;
  if (/min/.test(unit)) return n * 60;
  return n;
}

function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function highlightTimes(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  TIME_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_REGEX.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} style={{ color: 'var(--mise-warning)', fontWeight: 700 }}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--mise-background)',
};

export function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const { recipes, t } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);

  const [currentStep, setCurrentStep] = useState(0);
  const [timers, setTimers] = useState<Map<number, TimerState>>(new Map());
  const [voiceActive, setVoiceActive] = useState(false);
  const [finished, setFinished] = useState(false);

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const voiceActiveRef = useRef(voiceActive);
  voiceActiveRef.current = voiceActive;

  useEffect(() => {
    if (!recipe) navigate(-1);
  }, [recipe, navigate]);

  useEffect(() => {
    let wl: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(l => { wl = l; }).catch(() => {});
    return () => { wl?.release(); };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimers(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [idx, timer] of next) {
          if (timer.running && timer.remaining > 0) {
            const remaining = timer.remaining - 1;
            next.set(idx, {
              ...timer,
              remaining,
              running: remaining > 0 ? timer.running : false,
            });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    stepRefs.current[currentStep]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep]);

  const markDone = useCallback(() => {
    if (!recipe) return;
    if (currentStep >= recipe.steps.length - 1) {
      setFinished(true);
    } else {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, recipe]);

  const toggleTimer = useCallback((stepIdx: number) => {
    if (!recipe) return;
    setTimers(prev => {
      const next = new Map(prev);
      const existing = next.get(stepIdx);
      if (!existing) {
        const total = parseTimerSeconds(recipe.steps[stepIdx] ?? '') ?? 0;
        if (total <= 0) return prev;
        next.set(stepIdx, { total, remaining: total, running: true });
        return next;
      }
      if (existing.running) {
        next.set(stepIdx, { ...existing, running: false });
      } else if (existing.remaining > 0) {
        next.set(stepIdx, { ...existing, running: true });
      }
      return next;
    });
  }, [recipe]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (ev: { results: Iterable<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      const results = [...ev.results];
      const last = results[results.length - 1];
      if (!last?.isFinal) return;
      const transcript = last[0].transcript.toLowerCase();
      if (
        transcript.includes('next')
        || transcript.includes('επόμενο')
        || transcript.includes('siguiente')
      ) {
        markDone();
      }
    };

    recognition.onend = () => {
      if (voiceActiveRef.current) {
        try { recognition.start(); } catch { /* */ }
      }
    };

    if (voiceActive) {
      try { recognition.start(); } catch { /* */ }
    }

    return () => {
      recognition.stop();
    };
  }, [voiceActive, markDone]);

  if (!recipe) return null;

  const totalSteps = recipe.steps.length;
  const currentTimer = timers.get(currentStep);
  const showStickyTimer = Boolean(
    currentTimer && (currentTimer.running || currentTimer.remaining > 0),
  );
  const isLastStep = currentStep >= totalSteps - 1;

  if (finished) {
    return (
      <div style={shell}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, textAlign: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 48 }}>🎉</span>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 700,
            color: 'var(--mise-text-primary)', fontFamily: 'var(--mise-font-text)',
          }}>
            {t('cookComplete')}
          </h1>
          <p style={{
            margin: 0, fontSize: 14, color: 'var(--mise-text-secondary)',
            fontFamily: 'var(--mise-font-text)', lineHeight: 1.5, maxWidth: 280,
          }}>
            {t('cookCompleteHint')}
          </p>
          <button
            className="press"
            onClick={() => navigate(-1)}
            style={{
              marginTop: 20, padding: '12px 24px',
              borderRadius: 'var(--mise-radius-button)', border: 'none',
              background: 'var(--mise-primary)', color: '#FFFFFF',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={{
        flexShrink: 0,
        paddingTop: 'max(54px, env(safe-area-inset-top))',
        paddingLeft: 14, paddingRight: 14, paddingBottom: 8,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--mise-background)',
      }}>
        <button
          className="press"
          onClick={() => navigate(-1)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--mise-primary)', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--mise-font-text)', padding: '4px 0', flexShrink: 0,
          }}
        >
          {t('exitCook')}
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 13,
          color: 'var(--mise-text-secondary)', fontFamily: 'var(--mise-font-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {recipe.name}
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700,
          color: 'var(--mise-primary)', fontFamily: 'var(--mise-font-text)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {currentStep + 1} / {totalSteps}
        </span>
      </header>

      {showStickyTimer && currentTimer && (
        <div style={{
          flexShrink: 0,
          margin: '0 14px 8px',
          padding: '10px 14px',
          borderRadius: 14,
          background: 'rgba(245,158,11,0.14)',
          border: '1px solid rgba(245,158,11,0.35)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, color: 'var(--mise-warning)', fontWeight: 600,
              fontFamily: 'var(--mise-font-text)',
            }}>
              ⏱ {currentTimer.running ? 'Running' : 'Paused'} — step {currentStep + 1}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: 'var(--mise-warning)',
              fontFamily: 'var(--mise-font-text)', fontVariantNumeric: 'tabular-nums',
            }}>
              {formatTime(currentTimer.remaining)}
            </div>
          </div>
          <button
            className="press"
            onClick={() => toggleTimer(currentStep)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none',
              background: 'var(--mise-warning)', color: '#FFFFFF',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--mise-font-text)',
            }}
          >
            {currentTimer.running ? t('timerPause') : t('timerResume')}
          </button>
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {recipe.steps.map((step, idx) => {
          if (idx < currentStep) {
            return (
              <div
                key={idx}
                ref={el => { stepRefs.current[idx] = el; }}
                style={{
                  display: 'flex', gap: 10, opacity: 0.45,
                  padding: '4px 0', marginBottom: 6,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--mise-success)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--mise-text-secondary)',
                  textDecoration: 'line-through', lineHeight: 1.4,
                  fontFamily: 'var(--mise-font-text)',
                }}>
                  {step}
                </div>
              </div>
            );
          }

          if (idx === currentStep) {
            const stepTimer = timers.get(idx);
            const detectedSec = parseTimerSeconds(step);
            return (
              <div
                key={idx}
                ref={el => { stepRefs.current[idx] = el; }}
                style={{
                  position: 'relative',
                  background: 'var(--mise-glass-fill)',
                  border: '1.5px solid var(--mise-primary)',
                  borderRadius: 16, padding: 14, marginBottom: 12,
                  display: 'flex', gap: 10,
                }}
              >
                <span style={{
                  position: 'absolute', top: -8, left: 12,
                  background: 'var(--mise-primary)', color: '#FFFFFF',
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 6,
                  fontFamily: 'var(--mise-font-text)',
                }}>
                  {t('nowCooking')}
                </span>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--mise-primary)', flexShrink: 0, marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                  fontFamily: 'var(--mise-font-text)',
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  <div style={{
                    fontSize: 14, color: 'var(--mise-text-primary)', fontWeight: 500,
                    lineHeight: 1.6, fontFamily: 'var(--mise-font-text)',
                  }}>
                    {highlightTimes(step)}
                  </div>
                  {detectedSec != null && detectedSec > 0 && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 11, color: 'var(--mise-warning)', fontWeight: 600,
                          fontFamily: 'var(--mise-font-text)',
                        }}>
                          ⏱ Timer detected
                        </div>
                        <div style={{
                          fontSize: 20, fontWeight: 700, color: 'var(--mise-warning)',
                          fontFamily: 'var(--mise-font-text)', fontVariantNumeric: 'tabular-nums',
                        }}>
                          {stepTimer ? formatTime(stepTimer.remaining) : formatTime(detectedSec)}
                        </div>
                      </div>
                      {stepTimer && stepTimer.remaining === 0 ? (
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--mise-success)',
                          fontFamily: 'var(--mise-font-text)',
                        }}>
                          {t('timerDone')} ✓
                        </span>
                      ) : (
                        <button
                          className="press"
                          onClick={() => toggleTimer(idx)}
                          style={{
                            flexShrink: 0, padding: '8px 12px', borderRadius: 10, border: 'none',
                            background: 'var(--mise-warning)', color: '#FFFFFF',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'var(--mise-font-text)',
                          }}
                        >
                          {!stepTimer
                            ? t('timerStart')
                            : stepTimer.running
                              ? t('timerPause')
                              : t('timerResume')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              ref={el => { stepRefs.current[idx] = el; }}
              style={{ display: 'flex', gap: 10, padding: '4px 0' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--mise-primary)',
                fontFamily: 'var(--mise-font-text)',
              }}>
                {idx + 1}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--mise-text-tertiary)', lineHeight: 1.4,
                fontFamily: 'var(--mise-font-text)',
              }}>
                {step}
              </div>
            </div>
          );
        })}
      </div>

      <footer style={{
        flexShrink: 0,
        padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--mise-glass-border)',
        background: 'var(--mise-background)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          className="press"
          aria-label={t('voiceHint')}
          onClick={() => setVoiceActive(v => !v)}
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            border: voiceActive ? 'none' : '1px solid rgba(124,58,237,0.25)',
            background: voiceActive ? 'var(--mise-primary)' : 'rgba(124,58,237,0.1)',
            cursor: 'pointer', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: voiceActive ? '0 0 0 6px rgba(124,58,237,0.2)' : 'none',
          }}
        >
          <Mic size={20} color={voiceActive ? '#FFFFFF' : 'var(--mise-primary)'} />
          {voiceActive && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--mise-success)',
            }} />
          )}
        </button>
        <button
          className="press"
          onClick={markDone}
          style={{
            flex: 1, height: 44, borderRadius: 12, border: 'none',
            background: 'var(--mise-primary)', color: '#FFFFFF',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--mise-font-text)',
          }}
        >
          {isLastStep ? 'Finish cooking 🎉' : t('markDoneNext')}
        </button>
      </footer>
    </div>
  );
}
