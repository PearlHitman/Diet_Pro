import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { notifyUpdateAvailable } from './lib/pwa';

// With registerType: 'prompt', we control when the new SW activates.
// onNeedRefresh fires when a new SW has downloaded and is waiting.
// Calling updateSW(true) tells it to skip waiting and reload the page.
const updateSW = registerSW({
  onNeedRefresh() {
    notifyUpdateAvailable(() => updateSW(true));
  },
  onOfflineReady() {
    // App is cached and ready to work offline — no UI needed.
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
