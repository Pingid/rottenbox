import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

const icons = (name: string) => ({
  16: `icons/${name}-16.png`,
  32: `icons/${name}-32.png`,
  48: `icons/${name}-48.png`,
  128: `icons/${name}-128.png`,
})

export default defineManifest({
  manifest_version: 3,
  name: 'Rottenbox',
  description: pkg.description,
  version: pkg.version,
  icons: icons('icon-active'),
  action: {
    default_icon: icons('icon-active'),
    default_title: 'Rottenbox',
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      // supported sites only, see `ui/src/sites`
      matches: ['https://*.rottentomatoes.com/*', 'https://*.letterboxd.com/*', 'https://*.metacritic.com/*'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage'],
})
