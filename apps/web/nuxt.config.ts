import { fileURLToPath } from 'node:url';

const GROUND = '#FBE9E3';

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  components: [{ path: '~/components', pathPrefix: false }],
  alias: {
    '@cresus/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  },
  // Les tests e2e pilotent l'horloge et l'état via `window.__cresus` (exposé en dev, et sur demande en build).
  runtimeConfig: { public: { e2e: process.env.NUXT_PUBLIC_E2E === 'true' } },
  css: ['@fontsource-variable/nunito', '~/assets/css/tokens.css', '~/assets/css/base.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Cresus',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: GROUND },
        { name: 'description', content: 'La caisse de la buvette : un appui, une vente.' },
        // site privé des assos : jamais indexé (aussi en en-tête X-Robots-Tag côté API, et dans robots.txt)
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/maskable-512.png' },
      ],
    },
  },
  // PWA installable. Les pictos ne sont pas précachés (1,5 Mo) : mis en cache à la première vue, donc disponibles hors
  // ligne pour les articles déjà affichés. Le service worker ne touche jamais à /api (ni au socket).
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Cresus',
      short_name: 'Cresus',
      description: 'La caisse de la buvette : un appui, une vente.',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      theme_color: GROUND,
      background_color: GROUND,
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api(?:[/?]|$)/],
      globPatterns: ['**/*.{js,css,html,woff2,png}', 'favicon.svg'],
      globIgnores: ['**/200.html', '**/404.html', '*/**/*.html', 'pictos/**'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/pictos/'),
          handler: 'CacheFirst',
          options: { cacheName: 'pictos', expiration: { maxEntries: 200 } },
        },
      ],
    },
    devOptions: { enabled: false },
  },
  // En dev, Nuxt (3000) relaie /api vers l'API (3001), socket compris ; en production une seule origine sert tout.
  nitro: {
    devProxy: { '/api': { target: 'http://localhost:3001/api', changeOrigin: true, ws: true } },
  },
  typescript: { strict: true },
});
