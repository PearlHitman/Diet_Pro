// Top-level app shell + routes.

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-state';
import { subscribeToUpdate } from './lib/pwa';
import { T } from './tokens';

// ─── Error boundary ───────────────────────────────────────────
// Without this, any unhandled render error wipes the entire UI
// leaving a blank black screen with no indication of what went wrong.

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
        minHeight: '100vh', background: T.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, fontFamily: T.font, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          Something went wrong
        </div>
        <div style={{
          fontSize: 12, color: T.muted, marginBottom: 24,
          maxWidth: 320, wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px', borderRadius: 'var(--mise-radius-button)', border: 'none',
            background: 'var(--mise-primary)', color: '#FFFFFF',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
            boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
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
import { IngredientFormPage } from './pages/IngredientFormPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { MealTypePage } from './pages/MealTypePage';
import { LoadingPage } from './pages/LoadingPage';
import { ResultsPage } from './pages/ResultsPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { CookModePage } from './pages/CookModePage';
import { HistoryPage } from './pages/HistoryAndFavorites';
import { TabBar } from './components/Chrome';
import { Toaster } from './components/ui/sonner';
import { ChefHat } from './components/Icons';
import { isOnboarded } from './lib/onboarding-state';
import { OnboardingPage } from './pages/OnboardingPage';
import { DishPage } from './pages/DishPage';

function BrandedLoader() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);
  if (!visible) {
    return <div style={{ minHeight: '100vh', background: T.bg }} />;
  }
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: T.font, gap: 16,
    }}>
      <div
        className="mise-pulse"
        style={{
          width: 72, height: 72, borderRadius: 20,
          background: T.accentTint, border: `1px solid ${T.borderAcc}`,
          color: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChefHat size={32} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>Mise</div>
      <div style={{ fontSize: 12, color: T.muted }}>Loading…</div>
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

function Routed() {
  const { ready } = useApp();
  const location = useLocation();
  const isCook = location.pathname.endsWith('/cook');
  const [onboardChecked, setOnboardChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  useEffect(() => {
    isOnboarded().then(v => { setOnboarded(v); setOnboardChecked(true); });
  }, []);
  if (!ready || !onboardChecked) {
    return <BrandedLoader />;
  }
  if (!onboarded) {
    return <OnboardingPage onComplete={() => setOnboarded(true)} />;
  }
  return (
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
        <Route path="/recipe/:id/cook" element={<CookModePage />} />
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />

        <Route path="/dish" element={<DishPage />} />

        <Route path="/history" element={<HistoryPage />} />
        {/* Favorites is now a tab inside History (?view=favs). Redirect old links. */}
        <Route path="/favorites" element={<Navigate to="/history?view=favs" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      {!isCook && <TabBar />}
    </>
  );
}

function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      background: 'var(--mise-primary)', color: '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
      paddingBottom: '10px',
      paddingLeft: '16px',
      paddingRight: '16px',
      fontFamily: T.font, fontSize: 13, fontWeight: 600,
      boxShadow: '0px 4px 12px rgba(124, 58, 237, 0.3)',
    }}>
      <span>A new version is available</span>
      <button
        onClick={onUpdate}
        className="press"
        style={{
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.20)', color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.30)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          fontFamily: T.font,
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
