// Top-level app shell + routes.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/app-state';
import { T } from './tokens';

import { HomePage } from './pages/HomePage';
import { PantryPage } from './pages/PantryPage';
import { IngredientFormPage } from './pages/IngredientFormPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { MealTypePage } from './pages/MealTypePage';
import { LoadingPage } from './pages/LoadingPage';
import { ResultsPage } from './pages/ResultsPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { HistoryPage, FavoritesPage } from './pages/HistoryAndFavorites';

function Routed() {
  const { ready } = useApp();
  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.muted, fontFamily: T.font, fontSize: 14,
      }}>…</div>
    );
  }
  return (
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

      <Route path="/history" element={<HistoryPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AppProvider>
  );
}
