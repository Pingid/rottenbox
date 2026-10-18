import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }
import { spawnSync } from 'child_process'

const icons = (name: string) => ({
  16: `icons/${name}-16.png`,
  32: `icons/${name}-32.png`,
  48: `icons/${name}-48.png`,
  128: `icons/${name}-128.png`,
})

const tag = spawnSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf-8' }).stdout.toString().trim()
const [version] = /\d{1,}\.\d{1,}\.\d{1,}/.exec(tag) ?? [pkg.version]
export const browser = (process.env['BROWSER'] as any) ?? 'chrome'

export default defineManifest(() => {
  const firefox = {
    background: {
      scripts: ['src/background/service-worker.ts'],
    },
  }
  return {
    manifest_version: 3,
    name: 'Rottenbox',
    description: pkg.description,
    version: version,
    icons: icons('icon-active'),
    action: {
      default_icon: icons('icon-active'),
      default_title: 'Rottenbox',
    },
    background: {
      service_worker: 'src/background/service-worker.ts',
      type: 'module',
    },
    content_scripts: [
      {
        js: ['src/content/content-script.ts'],
        // supported sites only, see `ui/src/sites`
        matches: ['https://*.rottentomatoes.com/*', 'https://*.letterboxd.com/*', 'https://*.metacritic.com/*'],
        run_at: 'document_idle',
      },
    ],
    permissions: ['storage'],
    // lets the background worker fetch these hosts without CORS
    host_permissions: ['https://v3-cinemeta.strem.io/*', 'https://torrentio.strem.fun/*'],
    ...(browser === 'firefox' ? firefox : {}),
  }
})
