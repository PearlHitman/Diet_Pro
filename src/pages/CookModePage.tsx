import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, TimerReset } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/app-state';
import { toDateStr } from '../lib/nutrition';
import { prefersReducedMotion } from '../lib/motion';

interface TimerState {
  total: number;
  remaining: number;
  running: boolean;
}

function parseTimerSeconds(text: string): number {
  const number = String.raw`\d+(?:[.,]\d+)?`;
  const range = String.raw`(${number})(?:\s*[-–—]\s*(${number}))?`;
  const toNumber = (value: string | undefined) => value ? parseFloat(value.replace(',', '.')) : 0;
  const pickedValue = (match: RegExpMatchArray | null) => match ? toNumber(match[2] ?? match[1]) : 0;

  const hr = text.match(new RegExp(`${range}\\s*(?:hours?|hrs?|ώρες|ωρες|ώρα|ωρα)`, 'i'));
  const min = text.match(new RegExp(`${range}\\s*(?:minutes?|mins?|λεπτά|λεπτα|λεπτό|λεπτο|λεπ\\.)`, 'i'));
  const sec = text.match(new RegExp(`${range}\\s*(?:seconds?|secs?|δευτερόλεπτα|δευτερολεπτα|δευτ\\.?|δλ)`, 'i'));
  let total = 0;
  if (hr) total += pickedValue(hr) * 3600;
  if (min) total += pickedValue(min) * 60;
  if (sec) total += pickedValue(sec);
  return Math.round(total);
}

function fmt(secs: number) {
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function TimeHighlightedStep({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?|λεπτά|λεπτα|λεπτό|λεπτο|λεπ\.|ώρες|ωρες|ώρα|ωρα|δευτερόλεπτα|δευτερολεπτα|δευτ\.?|δλ))/gi);
  return (
    <>
      {parts.map((part, index) =>
        /\d/.test(part) && /min|sec|hour|hr|λεπτ|ωρ|ώρ|δευτ|δλ/i.test(part)
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
  const { recipes, t, addLoggedMeal } = useApp();
  const navigate = useNavigate();
  const recipe = recipes.find(r => r.id === id);
  const [mealLogged, setMealLogged] = useState(false);

  const steps = useMemo(() => recipe?.steps ?? [], [recipe]);
  const totalSteps = steps.length;

  const [completedCount, setCompletedCount] = useState(0);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});

  const reduceMotion = prefersReducedMotion();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      overflow: 'hidden',
      overscrollBehaviorX: 'none',
      touchAction: 'pan-y',
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
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '12px clamp(14px, 4vw, 20px) 10px',
        background: 'color-mix(in srgb, var(--mise-surface) 88%, transparent)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderBottom: '1px solid var(--mise-glass-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
              maxWidth: '100%',
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
        </div>

        {timer && !isComplete && (
          <div style={{
            marginTop: 12,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
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
              minWidth: 0,
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
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
                  maxWidth: 92,
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
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
                ...(reduceMotion ? { transition: 'none' } : { transition: 'width 1s linear' }),
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
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overscrollBehaviorX: 'none',
        padding: '14px clamp(14px, 4vw, 20px) 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 640,
          margin: '0 auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {steps.map((step, index) => {
            const isDone = index < completedCount;
            const isActive = index === activeIndex && !isComplete;
            const stepTimerSeconds = parseTimerSeconds(step);

            if (isDone) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => jumpToStep(index)}
                  className="press"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
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
                    maxWidth: '100%',
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
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
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

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
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
                      maxWidth: '100%',
                      color: 'var(--mise-text-primary)',
                      fontSize: 17,
                      lineHeight: 1.55,
                      fontWeight: 650,
                      overflowWrap: 'anywhere',
                      wordBreak: 'normal',
                      hyphens: 'auto',
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
                  maxWidth: '100%',
                  boxSizing: 'border-box',
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
                  maxWidth: '100%',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: 14,
                  lineHeight: 1.4,
                }}>
                  {step}
                </span>
                {stepTimerSeconds > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                    color: 'var(--mise-warning)',
                    fontSize: 12,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <TimerReset size={13} strokeWidth={2.2} />
                    {fmt(stepTimerSeconds)}
                  </span>
                )}
              </button>
            );
          })}

          {isComplete && (
            <div style={{
              marginTop: 10,
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
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

              {/* Log meal to nutrition */}
              {recipe && (
                <div style={{ marginTop: 16 }}>
                  {mealLogged ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 99,
                      background: 'rgba(16,185,129,0.15)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      fontSize: 13, fontWeight: 600, color: 'var(--mise-success)',
                    }}>
                      <Check size={14} strokeWidth={3} /> Logged to nutrition
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await addLoggedMeal({
                          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                          date: toDateStr(),
                          name: recipe.name,
                          source: 'recipe',
                          recipeId: recipe.id,
                          calories: recipe.calories,
                          protein: recipe.protein ?? 0,
                          carbs: recipe.carbs ?? 0,
                          fat: recipe.fat ?? 0,
                          servings: 1,
                        });
                        setMealLogged(true);
                      }}
                      style={{
                        padding: '10px 20px', borderRadius: 99,
                        border: '1px solid rgba(124,58,237,0.3)',
                        background: 'rgba(124,58,237,0.1)',
                        color: 'var(--mise-primary)',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--mise-font-text)',
                      }}
                    >
                      Log this meal to nutrition →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ height: 12 }} />
        </div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '12px clamp(14px, 4vw, 20px) max(12px, env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--mise-surface) 90%, transparent)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
        borderTop: '1px solid var(--mise-glass-border)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 640,
          minWidth: 0,
          margin: '0 auto',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
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
              maxWidth: '100%',
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
              overflow: 'hidden',
              boxShadow: isComplete
                ? '0 8px 22px color-mix(in srgb, var(--mise-success) 26%, transparent)'
                : '0 8px 22px color-mix(in srgb, var(--mise-primary) 28%, transparent)',
            }}
          >
            <span style={{
              minWidth: 0,
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
    </div>
  );
}
