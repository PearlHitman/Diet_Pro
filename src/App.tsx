// Top-level app shell + routes.

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-state';
import { subscribeToUpdate } from './lib/pwa';
import { T } from './tokens';
import { useMealtimePalette, applyPrimaryToRoot, MEAL_COLORS } from './lib/mealtime';
import { applyTone, type ToneMode } from './lib/theme';

// ---- Error boundary ----

interface EBState { error: Error | null }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, fontFamily: 'var(--font-sans)', textAlign: 'center',
      }}>
        <div style={{ fontSize: T.fontSize.hero, marginBottom: 16 }}>warning</div>
        <div style={{ fontSize: T.fontSize.lead, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Something went wrong
        </div>
        <div style={{
          fontSize: T.fontSize.caption, color: 'var(--text-2)', marginBottom: 24,
          maxWidth: 320, wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px', borderRadius: 'var(--radius-button)', border: 'none',
            background: 'var(--primary)', color: 'var(--on-primary)',
            fontSize: T.fontSize.body, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0px 4px 12px var(--primary-glow)',
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}

import { HomePage } from './pages/HomePage';
import { PantryPage } from './pages/PantryPage';
import { CookModePage } from './pages/CookModePage';
import { NutritionPage } from './pages/NutritionPage';
import { TabBar } from './components/Chrome';
import { Toaster } from './components/ui/sonner';
import { ChefHat } from './components/Icons';
import { isOnboarded } from './lib/onboarding-state';

const OnboardingPage    = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const IngredientFormPage = lazy(() => import('./pages/IngredientFormPage').then(m => ({ default: m.IngredientFormPage })));
const RecipeDetailPage  = lazy(() => import('./pages/RecipeDetailPage').then(m => ({ default: m.RecipeDetailPage })));
const DishPage          = lazy(() => import('./pages/DishPage').then(m => ({ default: m.DishPage })));
const SettingsPage      = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const MealTypePage      = lazy(() => import('./pages/MealTypePage').then(m => ({ default: m.MealTypePage })));
const LoadingPage       = lazy(() => import('./pages/LoadingPage').then(m => ({ default: m.LoadingPage })));
const ResultsPage       = lazy(() => import('./pages/ResultsPage').then(m => ({ default: m.ResultsPage })));
const HistoryPage       = lazy(() => import('./pages/HistoryAndFavorites').then(m => ({ default: m.HistoryPage })));
const ProfilePage       = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

function BrandedLoader() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(id);
  }, []);
  if (!visible) return <div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />;
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', gap: 16,
    }}>
      <div
        className="mise-pulse"
        style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--primary-dim)',
          border: '1px solid var(--border)',
          color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChefHat size={32} />
      </div>
      <div style={{ fontSize: T.fontSize.heading, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.4 }}>Mise</div>
      <div style={{ fontSize: T.fontSize.caption, color: 'var(--text-2)' }}>Loading...</div>
      <style>{`
        @keyframes misePulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
        .mise-pulse { animation: misePulse 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ---- Mealtime + tone controller ----
// Mounts inside AppProvider to read profile settings.
// Applies --primary every 60s and data-tone on every tone change.

function MealtimeController() {
  const { profile } = useApp();
  const autoColor   = profile.autoColor !== false; // default true
  const tone        = (profile.tone ?? 'warm-dark') as ToneMode;
  const manualColor = profile.manualColor ?? MEAL_COLORS.orange;

  useEffect(() => {
    applyTone(tone);
  }, [tone]);

  useMealtimePalette(autoColor);

  useEffect(() => {
    if (!autoColor) applyPrimaryToRoot(manualColor);
  }, [autoColor, manualColor]);

  return null;
}

// ---- Router ----

function Routed() {
  const { ready } = useApp();
  const location = useLocation();
  const isCook = location.pathname.endsWith('/cook');
  const [onboardChecked, setOnboardChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    isOnboarded().then(v => { setOnboarded(v); setOnboardChecked(true); });
  }, []);

  if (!ready || !onboardChecked) return <BrandedLoader />;

  return (
    <Suspense fallback={<BrandedLoader />}>
      <MealtimeController />
      {!onboarded ? (
        <OnboardingPage onComplete={() => setOnboarded(true)} />
      ) : (
        <>
          <Routes>
            <Route path="/recipe/:id/cook" element={<CookModePage />} />
          </Routes>

          {!isCook && (
            <>
              <div key={location.pathname} className="page-enter">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/pantry" element={<PantryPage />} />
                  <Route path="/pantry/add" element={<IngredientFormPage />} />
                  <Route path="/pantry/edit/:id" element={<IngredientFormPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/generate" element={<MealTypePage />} />
                  <Route path="/generate/loading" element={<LoadingPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/recipe/:id" element={<RecipeDetailPage />} />
                  <Route path="/dish" element={<DishPage />} />
                  <Route path="/nutrition" element={<NutritionPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/favorites" element={<Navigate to="/history?view=favs" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
              <TabBar />
            </>
          )}
        </>
      )}
    </Suspense>
  );
}

function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      background: 'var(--primary)', color: 'var(--on-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
      paddingBottom: '10px',
      paddingLeft: '16px',
      paddingRight: '16px',
      fontFamily: 'var(--font-sans)', fontSize: T.fontSize.small, fontWeight: 600,
      boxShadow: '0 4px 12px var(--primary-glow)',
    }}>
      <span>A new version is available</span>
      <button
        onClick={onUpdate}
        className="press"
        style={{
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.20)', color: 'inherit',
          border: '1px solid rgba(255,255,255,0.30)',
          cursor: 'pointer', fontSize: T.fontSize.caption, fontWeight: 600,
          fontFamily: 'var(--font-sans)',
        }}
      >
        Update now
      </button>
    </div>
  );
}

export function App() {
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    subscribeToUpdate(fn => setUpdateFn(() => fn));
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          {updateFn && <UpdateBanner onUpdate={updateFn} />}
          <Toaster position="top-center" richColors />
          <Routed />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
