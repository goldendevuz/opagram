import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ['buffer', 'util', 'events', 'stream', 'os', 'path', 'process', 'assert'], globals: { Buffer: true, process: true, global: true } }),
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
  ],
  // GramJS ships its own WebCrypto-based crypto module for browsers; use it instead of crypto-browserify
  resolve: { alias: [{ find: /^crypto$/, replacement: 'telegram/crypto/crypto.js' }] },
  build: { target: 'es2022' },
})
