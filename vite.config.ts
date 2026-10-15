/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// base './' keeps the build portable: it works at a domain root or in a sub-folder
// (GitHub Pages, a USB stick served by any static server, etc.). Routing is hash-based.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC')
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Mine Rescue Study',
        short_name: 'MR Study',
        description: 'Offline study aid for the coal mine rescue contest rules and statements of fact.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#14161a',
        theme_color: '#c8961e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precache the app shell AND the content JSON so everything works offline after first load.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,json,md,jpg,jpeg,webp}'],
        // Real rule books can be large; allow up to 15 MB per precached file.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
