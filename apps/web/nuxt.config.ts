import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  components: [{ path: '~/components', pathPrefix: false }],
  alias: {
    '@matreso/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
  },
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
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  nitro: {
    devProxy: { '/api': { target: 'http://localhost:3001/api', changeOrigin: true } },
  },
  typescript: { strict: true },
});
