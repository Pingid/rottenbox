import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.ts'

export default defineConfig({
  resolve: {
    alias: {
      '@rottenbox/ui': `${path.resolve(import.meta.dirname, '../ui/src')}`,
      '@': `${path.resolve(import.meta.dirname, 'src')}`,
    },
  },
  plugins: [tailwindcss(), solid(), crx({ manifest }), zip({ outDir: 'release', outFileName: `chrome.zip` })],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
})
