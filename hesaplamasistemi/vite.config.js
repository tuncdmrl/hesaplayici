import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Backend yok: tamamen statik bir tek sayfa uygulaması olarak derlenir ve
 * Vercel'e olduğu gibi yüklenir. PWA eklentisi "telefona ekle" desteğini ve
 * çevrimdışı çalışmayı sağlar.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon-192.png', 'app-icon-512.png'],
      manifest: {
        name: 'Anahtar Ayı · Ödeme Planı Hesaplayıcı',
        short_name: 'Anahtar Ayı',
        description:
          'Faizsiz tasarruf finansmanı ödeme planınızı hesaplayın, PDF olarak indirin.',
        lang: 'tr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f1f0',
        theme_color: '#d70014',
        icons: [
          { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // jsPDF'in hiç kullanmadığımız isteğe bağlı bağımlılıkları önbelleğe alınmaz.
        globIgnores: ['**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
