import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // เจอเวอร์ชันใหม่ = อัปเดต+รีโหลดให้อัตโนมัติ (ไม่ค้างแคช)
      injectRegister: false, // ลงทะเบียน SW ผ่าน useRegisterSW hook แทน
      // ใช้ manifest.json ของเราเองใน public/ (ไม่ให้ปลั๊กอิน gen ทับ)
      manifest: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      workbox: {
        // precache app shell (JS/CSS/HTML) + ไอคอน
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA: เปิดแอปได้ตอน offline
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // แผนที่ OpenStreetMap — CacheFirst เก็บ tile ที่เคยโหลด
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }, // 0 = opaque (cross-origin img)
            },
          },
          {
            // Google Fonts (CSS)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            // Google Fonts (ไฟล์ฟอนต์)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OSRM: เก็บเส้นทางล่าสุดไว้ (เผื่อสัญญาณหลุดชั่วคราว)
            urlPattern: /^https:\/\/router\.project-osrm\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osrm-routes',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Open-Meteo: พยากรณ์ล่าสุดใช้ต่อได้ตอนหลุด
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 3 },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // เปิด SW เฉพาะ production
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
