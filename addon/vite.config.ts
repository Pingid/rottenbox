import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import zip from 'vite-plugin-zip-pack'

import manifest, { browser } from './manifest.config.ts'

// `BROWSER=firefox` builds the Firefox variant; each browser gets its own dist/ and zip
const outDir = `dist/${browser}`

export default defineConfig({
  resolve: {
    alias: {
      '@rottenbox/ui': `${path.resolve(import.meta.dirname, '../ui/src')}`,
      '@': `${path.resolve(import.meta.dirname, 'src')}`,
    },
  },
  build: { outDir, emptyOutDir: true },
  plugins: [
    tailwindcss(),
    solid(),
    crx({ manifest, browser }),
    //
    zip({ inDir: outDir, outDir: 'release', outFileName: `${browser}.zip` }),
  ],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//, /moz-extension:\/\//],
    },
  },
})
