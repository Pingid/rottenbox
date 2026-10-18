import { Manifest } from '../lib'

import * as Config from './config'
import * as Theme from './theme'

/**
 * Portable settings file: what you'd want in another browser, not this one's
 * panel placement. Same shape as a shareable pack, plus actions and theme.
 */
export const FILENAME = 'rottenbox-settings.json'

export const toManifest = (c: Config.Config, theme: Theme.Mode): Manifest.Manifest => ({
  app: 'rottenbox',
  version: Manifest.VERSION,
  theme,
  quality: c.quality,
  // plain copies of the store's proxies
  sources: JSON.parse(JSON.stringify(c.sources)),
  actions: JSON.parse(JSON.stringify(c.actions)),
})

export const stringify = Manifest.stringify

export type Restored = { theme: Theme.Mode; quality: string; sources: Config.Source[]; actions: Config.Action[] }

export type Parsed = { ok: true; settings: Restored } | { ok: false; error: string }

/** Read a pasted or uploaded file; missing lists keep the defaults, matching how saved settings load. */
export const parse = (text: string): Parsed => {
  const parsed = Manifest.parse(text)
  if (!parsed.ok) return parsed
  const m = parsed.manifest
  return {
    ok: true,
    settings: {
      theme: Theme.MODES.includes(m.theme as Theme.Mode) ? (m.theme as Theme.Mode) : 'system',
      quality: m.quality ?? 'all',
      sources: m.sources.length ? m.sources : structuredClone(Config.DEFAULT_SOURCES),
      actions: m.actions ?? structuredClone(Config.DEFAULT_ACTIONS),
    },
  }
}

/** Save `text` as a file via a temporary blob link; works from inside a content script too. */
export const download = (text: string, filename = FILENAME) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
