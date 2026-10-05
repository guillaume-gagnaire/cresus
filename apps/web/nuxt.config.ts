import { fileURLToPath } from 'node:url';

// Routes servies par l’API (même origine que le SPA) : le service worker ne doit jamais les traiter comme une
// navigation du SPA ni les mettre en cache (API REST, MCP et OAuth des Tasks 38–40, métadonnées .well-known).
const SERVER_ROUTES = ['api', 'mcp', 'authorize', 'token', 'register', 'revoke', '.well-known'];
const navigateFallbackDenylist = SERVER_ROUTES.map((route) => new RegExp(`^/${route.replaceAll('.', '\\.')}(?:[/?]|$)`));

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  components: [{ path: '~/components', pathPrefix: false }],
  alias: {
    '@matreso/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
  },
  // Les tests e2e pilotent le store via `window.__treso` (toujours exposé en dev, sur demande en build).
  runtimeConfig: { public: { e2e: process.env.NUXT_PUBLIC_E2E === 'true' } },
  css: [
    '@fontsource-variable/bricolage-grotesque',
    '@fontsource-variable/figtree',
    '~/assets/css/tokens.css',
    '~/assets/css/base.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Ma Tréso',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1F1A2E' },
        { name: 'description', content: 'Ce mois-ci, avec tes rentrées et tes charges, est-ce que ça passe ?' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // iOS utilise cette icône plutôt que celles du manifeste : on lui donne la version à fond plein (sans transparence).
        { rel: 'apple-touch-icon', href: '/icons/maskable-512.png' },
      ],
    },
  },
  // PWA installable. Les icônes PNG de public/icons sont rendues une fois depuis favicon.svg (maskable-512 : fond plein,
  // lettres dans la zone de sécurité). Le service worker précache les assets du build mais ne touche jamais aux routes serveur.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Ma Tréso',
      short_name: 'Ma Tréso',
      description: 'Ce mois-ci, avec tes rentrées et tes charges, est-ce que ça passe ?',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      theme_color: '#1F1A2E',
      background_color: '#FFF7EC',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist,
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      // Le SPA n’a qu’une coquille HTML (index.html, précachée sous « / » et servie en repli de navigation). Les copies
      // identiques que Nuxt prérend (200, 404, /login…) alourdiraient l’installation et feraient échouer tout le précache
      // si le serveur ne répondait pas 200 sur chacune de ces URL.
      globIgnores: ['**/200.html', '**/404.html', '*/**/*.html'],
    },
    devOptions: { enabled: false },
  },
  nitro: {
    devProxy: { '/api': { target: 'http://localhost:3001/api', changeOrigin: true } },
  },
  typescript: { strict: true },
});
