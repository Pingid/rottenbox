import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }
import { spawnSync } from 'child_process'

const icons = (name: string) => ({
  16: `icons/${name}-16.png`,
  32: `icons/${name}-32.png`,
  48: `icons/${name}-48.png`,
  128: `icons/${name}-128.png`,
})

// CI passes the release tag as VERSION; locally fall back to the latest git tag
const tag =
  process.env['VERSION'] ??
  spawnSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf-8' }).stdout.toString().trim()
const [version] = /\d{1,}\.\d{1,}\.\d{1,}/.exec(tag) ?? [pkg.version]

export type Browser = 'chrome' | 'firefox'
export const browser: Browser = process.env['BROWSER'] === 'firefox' ? 'firefox' : 'chrome'

/** Firefox add-on id; tied to the AMO signing account, so it must never change once published. */
export const GECKO_ID = 'rottenbox@pingid.github.io'

export default defineManifest(() => {
  // Firefox has no MV3 service workers: the same module runs as an event page instead
  const firefox = {
    background: {
      scripts: ['src/background/service-worker.ts'],
      type: 'module' as const,
    },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        // 127+ grants MV3 host_permissions at install; `fromFetch` needs AbortSignal.timeout
        strict_min_version: '128.0',
        // self-hosted updates: each release ships an updates.json pointing at its signed xpi
        update_url: 'https://github.com/Pingid/rottenbox/releases/latest/download/updates.json',
        // page titles are sent to Cinemeta / stream addons to look torrents up
        data_collection_permissions: { required: ['websiteContent' as const] },
      },
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
