import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// the desktop app (Tauri) serves files from its own protocol, where a service worker cannot run
const desktop = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  clearScreen: false,
  plugins: [
    react(),
    ...(desktop
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'OpaGram',
              short_name: 'OpaGram',
              description: 'Sodda Telegram klient',
              lang: 'uz',
              theme_color: '#0B0813',
              background_color: '#0B0813',
              display: 'standalone',
              icons: [
                { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
              ],
            },
          }),
        ]),
  ],
  build: { target: 'es2022' },
})
