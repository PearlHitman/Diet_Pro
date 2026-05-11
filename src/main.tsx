
import React from 'react';
import ReactDOM from 'react-dom/client';
import './animations.css';
import { App } from './App';
import './animations.css';  // ← πρόσθεσε αυτή τη γραμμή

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
