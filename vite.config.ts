/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Test config — run with `npm test` (watch) or `npm run test:run` (once).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mise',
        short_name: 'Mise',
        description: 'Your AI sous chef. Pantry-aware recipes powered by Claude.',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('lucide-react')) return 'lucide-icons';
          if (id.includes('@radix-ui')) return 'radix-ui';
          if (id.includes('@anthropic-ai')) return 'anthropic-sdk';
          if (id.includes('react-router')) return 'react-router';
          if (id.includes('react-dom') || id.includes('/react/'))
            return 'react-core';
        },
      },
    },
    // All output chunks are split & stay under Vite’s default 500 kB; limit is a fallback.
    chunkSizeWarningLimit: 700,
  },
});
