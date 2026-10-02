import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 5173 is AZONE — run both side by side
  server: { port: 5174 },
  preview: { port: 4174 },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        id: '/',
        name: 'APAY — Aznar Payroll Platform',
        short_name: 'APAY',
        description: 'Attendance, payroll computation, deductions, payslips and government reports.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#F5F8FE',
        theme_color: '#0F1B3D',
        categories: ['business', 'finance', 'productivity'],
        shortcuts: [
          { name: 'Payroll periods', url: '/app/periods' },
          { name: 'Employees', url: '/app/employees' },
          { name: 'Reports', url: '/app/reports' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Payroll data is never served from cache — only the app shell and fonts are
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
