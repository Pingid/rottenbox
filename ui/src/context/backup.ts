import * as Config from './config'
import * as Theme from './theme'

/**
 * Portable settings file: what you'd want in another browser, not this one's
 * panel placement. `version` bumps when the shape changes, so old files can
 * still be read (or refused) later.
 */
export type Manifest = {
  app: 'rottenbox'
  version: 1
  theme: Theme.Mode
  quality: string
  providers: Config.StreamProvider[]
  actions: Config.Action[]
}

export const VERSION = 1
export const FILENAME = 'rottenbox-settings.json'

export const toManifest = (c: Config.Config, theme: Theme.Mode): Manifest => ({
  app: 'rottenbox',
  version: VERSION,
  theme,
  quality: c.quality,
  // copied out of the store's proxies
  providers: c.providers.map((x) => ({ ...x })),
  actions: c.actions.map((x) => ({ ...x })),
})

export const stringify = (m: Manifest) => JSON.stringify(m, null, 2)

export type Parsed = { ok: true; manifest: Manifest } | { ok: false; error: string }

/** Read a pasted or uploaded file, normalizing entries the same way saved settings are loaded. */
export const parse = (text: string): Parsed => {
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: "That isn't valid JSON." }
  }
  if (!json || typeof json !== 'object' || json.app !== 'rottenbox') {
    return { ok: false, error: "That isn't a Rottenbox settings file." }
  }
  if (typeof json.version !== 'number' || json.version > VERSION) {
    return { ok: false, error: 'This file is from a newer version of Rottenbox.' }
  }
  return {
    ok: true,
    manifest: {
      app: 'rottenbox',
      version: VERSION,
      theme: Theme.MODES.includes(json.theme) ? json.theme : 'system',
      quality: typeof json.quality === 'string' ? json.quality : 'all',
      // missing lists keep the defaults, matching how saved settings load
      providers: structuredClone(Config.loadProviders(json)),
      actions: structuredClone(Config.loadActions(json)),
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
