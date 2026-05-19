import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic, TimerReset } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-state';

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
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

interface TimerState {
  total: number;
  remaining: number;
  running: boolean;
}

function parseTimerSeconds(text: string): number {
  const hr = text.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|hours|hrs)/i);
  const min = text.match(/(\d+(?:\.\d+)?)\s*(?:minute|min|minutes|mins)/i);
  const sec = text.match(/(\d+(?:\.\d+)?)\s*(?:second|sec|seconds|secs)/i);
  let total = 0;
  if (hr) total += parseFloat(hr[1]) * 3600;
  if (min) total += parseFloat(min[1]) * 60;
  if (sec) total += parseFloat(sec[1]);
  return Math.round(total);
}

function fmt(secs: number) {
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function TimeHighlightedStep({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?))/gi);
  return (
    <>
      {parts.map((part, index) =>
        /\d/.test(part) && /min|sec|hour|hr/i.test(part)
          ? (
            <span key={index} style={{ color: 'var(--mise-warning)', fontWeight: 800 }}>
              {part}
            </span>
          )
          : <React.Fragment key={index}>{part}</React.Fragment>,
      )}
    </>
  );
}

function playTimerDoneTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.75);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
  } catch {
    // Audio can be blocked until the user interacts; the timer still works.
  }
}

export function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const { recipes, t, profile } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);

  const steps = recipe?.steps ?? [];
  const totalSteps = steps.length;

  const [completedCount, setCompletedCount] = useState(0);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const [voiceOn, setVoiceOn] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  const isComplete = totalSteps > 0 && completedCount >= totalSteps;
  const activeIndex = Math.min(completedCount, Math.max(totalSteps - 1, 0));
  const timer = timers[activeIndex];

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen')
      .then(lock => { wakeLockRef.current = lock; })
      .catch(() => {});
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!steps[activeIndex] || timers[activeIndex] !== undefined || isComplete) return;
    const seconds = parseTimerSeconds(steps[activeIndex]);
    if (seconds > 0) {
      setTimers(prev => ({
        ...prev,
        [activeIndex]: { total: seconds, remaining: seconds, running: false },
      }));
    }
  }, [activeIndex, isComplete, steps, timers]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!timer?.running || isComplete) return;

    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        const current = prev[activeIndex];
        if (!current?.running) return prev;
        if (current.remaining <= 1) {
          playTimerDoneTone();
          return { ...prev, [activeIndex]: { ...current, remaining: 0, running: false } };
        }
        return {
          ...prev,
          [activeIndex]: { ...current, remaining: current.remaining - 1 },
        };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeIndex, isComplete, timer?.running]);

  const markDoneAndNext = useCallback(() => {
    setCompletedCount(count => Math.min(count + 1, totalSteps));
  }, [totalSteps]);

  const goPrevious = useCallback(() => {
    setCompletedCount(count => Math.max(count - 1, 0));
  }, []);

  const jumpToStep = useCallback((index: number) => {
    setCompletedCount(Math.min(Math.max(index, 0), totalSteps));
  }, [totalSteps]);

  const toggleTimer = useCallback(() => {
    setTimers(prev => {
      const current = prev[activeIndex];
      if (!current) return prev;
      if (current.remaining === 0) {
        return { ...prev, [activeIndex]: { ...current, remaining: current.total, running: true } };
      }
      return { ...prev, [activeIndex]: { ...current, running: !current.running } };
    });
  }, [activeIndex]);

  const startVoice = useCallback(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = profile.language === 'EL' ? 'el-GR' : profile.language === 'ES' ? 'es-ES' : 'en-US';
    rec.onresult = (event: ISpeechRecognitionEvent) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        parts.push(event.results[i][0].transcript.toLowerCase());
      }
      if (/\b(next|siguiente|\u03b5\u03c0\u03cc\u03bc\u03b5\u03bd\u03bf)\b/.test(parts.join(' '))) {
        setCompletedCount(count => Math.min(count + 1, totalSteps));
      }
    };
    rec.onerror = () => setVoiceOn(false);
    rec.onend = () => setVoiceOn(false);
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

  useEffect(() => {
    if (isComplete) return;
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex, isComplete]);

  if (!recipe) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--mise-background)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mise-font-text)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '12px 28px',
            borderRadius: 'var(--mise-radius-pill)',
            background: 'var(--mise-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {t('back')}
        </button>
      </div>
    );
  }

  const timerProgress = timer ? ((timer.total - timer.remaining) / timer.total) * 100 : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, var(--mise-surface) 0%, var(--mise-background) 100%)',
      color: 'var(--mise-text-primary)',
      fontFamily: 'var(--mise-font-text)',
      paddingTop: 'env(safe-area-inset-top)',
      paddingRight: 'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
    }}>
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: '12px 18px 10px',
        background: 'color-mix(in srgb, var(--mise-surface) 88%, transparent)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderBottom: '1px solid var(--mise-glass-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label={t('back')}
            className="press"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: '1px solid color-mix(in srgb, var(--mise-primary) 22%, transparent)',
              background: 'var(--mise-glass-fill)',
              color: 'var(--mise-text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {recipe.name}
            </div>
            <div style={{
              marginTop: 2,
              fontSize: 12,
              color: 'var(--mise-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {isComplete
                ? t('cookComplete')
                : t('stepOf', { current: activeIndex + 1, total: totalSteps })}
            </div>
          </div>

          <button
            onClick={voiceOn ? stopVoice : startVoice}
            aria-label={t('voiceHint')}
            className="press"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: voiceOn
                ? '1px solid var(--mise-primary)'
                : '1px solid color-mix(in srgb, var(--mise-primary) 22%, transparent)',
              background: voiceOn
                ? 'color-mix(in srgb, var(--mise-primary) 14%, transparent)'
                : 'var(--mise-glass-fill)',
              color: voiceOn ? 'var(--mise-primary)' : 'var(--mise-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: voiceOn ? 'miseCookMicPulse 1.4s ease-in-out infinite' : 'none',
            }}
          >
            <Mic size={17} strokeWidth={2.25} />
          </button>
        </div>

        {timer && !isComplete && (
          <div style={{
            marginTop: 12,
            borderRadius: 18,
            border: '1px solid color-mix(in srgb, var(--mise-warning) 42%, var(--mise-glass-border))',
            background: 'color-mix(in srgb, var(--mise-warning) 10%, var(--mise-glass-elevated))',
            boxShadow: 'var(--mise-shadow-sm)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px 10px',
            }}>
              <TimerReset
                size={20}
                strokeWidth={2.1}
                color={timer.remaining === 0 ? 'var(--mise-success)' : 'var(--mise-warning)'}
                style={{ flexShrink: 0 }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: timer.remaining === 0 ? 'var(--mise-success)' : 'var(--mise-warning)',
                }}>
                  {timer.remaining === 0
                    ? t('timerDone')
                    : `${timer.running ? 'Running' : 'Timer'} - ${t('stepOf', { current: activeIndex + 1, total: totalSteps })}`}
                </div>
                <div style={{
                  marginTop: 2,
                  fontSize: 28,
                  lineHeight: 1,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--mise-text-primary)',
                }}>
                  {timer.remaining === 0 ? fmt(0) : fmt(timer.remaining)}
                </div>
              </div>

              <button
                onClick={toggleTimer}
                className="press"
                style={{
                  minWidth: 74,
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 11,
                  border: 'none',
                  background: timer.running ? 'var(--mise-warning)' : 'var(--mise-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'var(--mise-font-text)',
                }}
              >
                {timer.remaining === 0
                  ? t('timerStart')
                  : timer.running
                    ? t('timerPause')
                    : timer.remaining === timer.total
                      ? t('timerStart')
                      : t('timerResume')}
              </button>
            </div>
            <div style={{ height: 3, background: 'color-mix(in srgb, var(--mise-warning) 18%, transparent)' }}>
              <div style={{
                width: `${timerProgress}%`,
                height: '100%',
                background: timer.remaining === 0 ? 'var(--mise-success)' : 'var(--mise-warning)',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        padding: '14px 20px 16px',
      }}>
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {steps.map((step, index) => {
            const isDone = index < completedCount;
            const isActive = index === activeIndex && !isComplete;

            if (isDone) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => jumpToStep(index)}
                  className="press"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--mise-text-secondary)',
                    cursor: 'pointer',
                    opacity: 0.58,
                    textAlign: 'left',
                    fontFamily: 'var(--mise-font-text)',
                  }}
                >
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--mise-success) 58%, white)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textDecoration: 'line-through',
                    fontSize: 14,
                    lineHeight: 1.35,
                  }}>
                    {step}
                  </span>
                </button>
              );
            }

            if (isActive) {
              return (
                <div
                  key={index}
                  ref={activeRef}
                  style={{
                    position: 'relative',
                    margin: '10px 0 12px',
                    borderRadius: 20,
                    border: '1.5px solid var(--mise-primary)',
                    background: 'color-mix(in srgb, var(--mise-primary) 5%, var(--mise-glass-elevated))',
                    boxShadow: '0 12px 34px color-mix(in srgb, var(--mise-primary) 18%, transparent)',
                    padding: '24px 18px 22px',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: 16,
                    padding: '4px 10px',
                    borderRadius: 7,
                    background: 'var(--mise-primary)',
                    color: '#fff',
                    fontSize: 11,
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    boxShadow: '0 6px 14px color-mix(in srgb, var(--mise-primary) 24%, transparent)',
                  }}>
                    {t('nowCooking')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 14,
                      background: 'var(--mise-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: 16,
                      fontWeight: 900,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {index + 1}
                    </div>

                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      color: 'var(--mise-text-primary)',
                      fontSize: 18,
                      lineHeight: 1.55,
                      fontWeight: 650,
                      wordBreak: 'break-word',
                    }}>
                      <TimeHighlightedStep text={step} />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => jumpToStep(index)}
                className="press"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '10px 0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--mise-text-secondary)',
                  cursor: 'pointer',
                  opacity: 0.72,
                  textAlign: 'left',
                  fontFamily: 'var(--mise-font-text)',
                }}
              >
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: '1px solid color-mix(in srgb, var(--mise-primary) 36%, var(--mise-glass-border))',
                  color: 'var(--mise-primary)',
                  background: 'color-mix(in srgb, var(--mise-primary) 8%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 750,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 1,
                }}>
                  {index + 1}
                </span>
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: 14,
                  lineHeight: 1.4,
                }}>
                  {step}
                </span>
              </button>
            );
          })}

          {isComplete && (
            <div style={{
              marginTop: 10,
              padding: '24px 18px',
              borderRadius: 20,
              border: '1px solid color-mix(in srgb, var(--mise-success) 35%, var(--mise-glass-border))',
              background: 'color-mix(in srgb, var(--mise-success) 9%, var(--mise-glass-elevated))',
              textAlign: 'center',
              boxShadow: 'var(--mise-shadow-sm)',
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 18,
                margin: '0 auto 12px',
                background: 'var(--mise-success)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Check size={26} strokeWidth={3} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 850, marginBottom: 6 }}>
                {t('cookComplete')}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--mise-text-secondary)' }}>
                {t('cookCompleteHint')}
              </div>
            </div>
          )}

          <div style={{ height: 12 }} />
        </div>
      </div>

      <div style={{
        padding: '12px 20px max(12px, env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--mise-surface) 90%, transparent)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderTop: '1px solid var(--mise-glass-border)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={goPrevious}
            disabled={completedCount === 0}
            aria-label={t('back')}
            className="press"
            style={{
              width: 52,
              height: 54,
              borderRadius: 15,
              border: '1px solid color-mix(in srgb, var(--mise-primary) 24%, var(--mise-glass-border))',
              background: completedCount === 0
                ? 'color-mix(in srgb, var(--mise-glass-fill) 50%, transparent)'
                : 'var(--mise-glass-fill)',
              color: completedCount === 0 ? 'var(--mise-text-tertiary)' : 'var(--mise-primary)',
              cursor: completedCount === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={19} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={isComplete ? () => navigate(-1) : markDoneAndNext}
            className="press"
            style={{
              flex: 1,
              minWidth: 0,
              height: 54,
              borderRadius: 15,
              border: 'none',
              background: isComplete ? 'var(--mise-success)' : 'var(--mise-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 850,
              fontFamily: 'var(--mise-font-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: isComplete
                ? '0 8px 22px color-mix(in srgb, var(--mise-success) 26%, transparent)'
                : '0 8px 22px color-mix(in srgb, var(--mise-primary) 28%, transparent)',
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {isComplete ? t('cookComplete') : t('markDoneNext')}
            </span>
            {!isComplete && <ArrowRight size={17} strokeWidth={2.6} style={{ flexShrink: 0 }} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes miseCookMicPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mise-primary) 34%, transparent); }
          50% { box-shadow: 0 0 0 8px transparent; }
        }
      `}</style>
    </div>
  );
}
