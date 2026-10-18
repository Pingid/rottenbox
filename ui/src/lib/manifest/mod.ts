import * as Stremio from '../stremio/mod'
import { Ratings, type Rating } from '../ratings'
import type { Req } from '../util'

import {
  METHODS,
  VERSION,
  type Action,
  type HttpMap,
  type HttpSource,
  type Link,
  type Manifest,
  type Source,
} from './types'

export * from './types'

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const id = (v: unknown) => (typeof v === 'string' && v ? v : newId())

export const newAction = (id: string, a: Partial<Action> = {}): Action => ({
  id,
  label: '',
  method: 'LINK',
  url: '',
  headers: '',
  body: '',
  ...a,
})

export const EMPTY_MAP: HttpMap = { items: '', value: '', max: '', label: '', url: '' }

/** A blank source of the given kind, for "add" buttons. */
export const blank = (kind: Source['kind']): Source => {
  const base = { id: newId(), label: '', enabled: true }
  if (kind === 'stremio') return { ...base, kind, url: '' }
  if (kind === 'links') return { ...base, kind, links: [{ id: newId(), label: '', url: '' }] }
  return { ...base, kind, url: '', headers: '', produces: 'rating', map: { ...EMPTY_MAP } }
}

/** One saved / imported action, or null if it's unusable. */
export const action = (a: any): Action | null => {
  if (!a || typeof a !== 'object' || typeof a.url !== 'string') return null
  return newAction(id(a.id), {
    label: str(a.label),
    method: METHODS.includes(a.method) ? a.method : 'LINK',
    url: a.url,
    headers: str(a.headers),
    body: str(a.body),
  })
}

const link = (l: any): Link | null =>
  l && typeof l.url === 'string' ? { id: id(l.id), label: str(l.label), url: l.url } : null

/** One saved / imported source, filling missing fields; null for unknown kinds. */
export const source = (s: any): Source | null => {
  if (!s || typeof s !== 'object') return null
  const base = { id: id(s.id), label: str(s.label), enabled: s.enabled !== false }
  switch (s.kind) {
    case 'stremio':
      return typeof s.url === 'string' ? { ...base, kind: 'stremio', url: s.url } : null
    case 'links':
      return Array.isArray(s.links)
        ? { ...base, kind: 'links', links: s.links.map(link).filter((x: Link | null) => !!x) }
        : null
    case 'http': {
      if (typeof s.url !== 'string') return null
      const m = s.map && typeof s.map === 'object' ? s.map : {}
      return {
        ...base,
        kind: 'http',
        url: s.url,
        headers: str(s.headers),
        produces: s.produces === 'links' ? 'links' : 'rating',
        // `max` may be written as a number in hand-made files
        map: {
          items: str(m.items),
          value: str(m.value),
          max: typeof m.max === 'number' ? String(m.max) : str(m.max),
          label: str(m.label),
          url: str(m.url),
        },
      }
    }
    default:
      return null
  }
}

const list = <T>(xs: unknown, f: (x: any) => T | null): T[] =>
  Array.isArray(xs) ? xs.map(f).filter((x): x is T => x !== null) : []

export const sources = (xs: unknown) => list(xs, source)
export const actions = (xs: unknown) => list(xs, action)

export type Parsed = { ok: true; manifest: Manifest } | { ok: false; error: string }

/** Validate a manifest object, normalizing each entry; unknown entries are dropped. */
export const fromJson = (json: any): Parsed => {
  if (!json || typeof json !== 'object' || json.app !== 'rottenbox')
    return { ok: false, error: "That isn't a Rottenbox manifest." }
  if (json.version !== VERSION) return { ok: false, error: `Unsupported manifest version (${json.version}).` }
  return {
    ok: true,
    manifest: {
      app: 'rottenbox',
      version: VERSION,
      name: typeof json.name === 'string' ? json.name : undefined,
      sources: sources(json.sources),
      actions: Array.isArray(json.actions) ? actions(json.actions) : undefined,
      theme: typeof json.theme === 'string' ? json.theme : undefined,
      quality: typeof json.quality === 'string' ? json.quality : undefined,
    },
  }
}

export const parse = (text: string): Parsed => {
  try {
    return fromJson(JSON.parse(text))
  } catch {
    return { ok: false, error: "That isn't valid JSON." }
  }
}

export const stringify = (m: Manifest) => JSON.stringify(m, null, 2)

/** Value at a dot path (`a.b.0.c`); an empty path is the value itself. */
export const pick = (v: unknown, path: string): unknown => {
  if (!path.trim()) return v
  let cur: any = v
  for (const k of path.trim().split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[k]
  }
  return cur
}

export type Detected = { name?: string; sources: Source[] }

/**
 * Turn whatever was pasted into sources: Rottenbox manifest json, or a url to
 * one, or a Stremio addon (install link, `manifest.json` url or base url).
 */
export const detect = async (r: Req.Client, input: string): Promise<Detected> => {
  const text = input.trim()
  if (text.startsWith('{')) {
    const parsed = parse(text)
    if (!parsed.ok) throw new Error(parsed.error)
    return { name: parsed.manifest.name, sources: parsed.manifest.sources }
  }
  const url = text.replace(/^stremio:\/\//i, 'https://')
  if (!/^https?:\/\//i.test(url)) throw new Error('Paste a url or manifest json.')
  // a url to a json file is fetched as is; anything else is taken as an addon base
  const target = /\.json(\?|#|$)/i.test(url) ? url : `${Stremio.baseUrl(url)}/manifest.json`
  const json = await r.json<any>(target)
  if (json?.app === 'rottenbox') {
    const parsed = fromJson(json)
    if (!parsed.ok) throw new Error(parsed.error)
    return { name: parsed.manifest.name, sources: parsed.manifest.sources }
  }
  if (Stremio.isManifest(json)) {
    if (!Stremio.serves(json, 'stream')) throw new Error(`${json.name} doesn't provide streams.`)
    return { sources: [{ kind: 'stremio', id: newId(), label: json.name, url: Stremio.baseUrl(url), enabled: true }] }
  }
  throw new Error("That url isn't a Stremio addon or a Rottenbox manifest.")
}

export type MappedLink = { label: string; url: string }

/** An http source's json response as ratings or links, per its `map`; unusable entries are skipped. */
export const mapHttp = (s: HttpSource, json: unknown): { ratings: Rating[]; links: MappedLink[] } => {
  const picked = s.map.items.trim() ? pick(json, s.map.items) : json
  const items = Array.isArray(picked) ? picked : picked == null ? [] : [picked]
  const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
  const ratings: Rating[] = []
  const links: MappedLink[] = []
  items.forEach((item, i) => {
    const label = text(pick(item, s.map.label)) || s.label || 'Rating'
    const url = s.map.url.trim() ? text(pick(item, s.map.url)) : ''
    if (s.produces === 'links') {
      if (/^https?:\/\//i.test(url)) links.push({ label, url })
      return
    }
    // `max` is a number, a path, or unset (out of 10)
    const max = s.map.max.trim() ? (Number.isFinite(Number(s.map.max)) ? s.map.max : pick(item, s.map.max)) : 10
    const r = Ratings.from({
      id: `${s.id}:${items.length > 1 ? label || i : ''}`,
      label,
      value: pick(item, s.map.value),
      max,
      url: /^https?:\/\//i.test(url) ? url : undefined,
    })
    if (r) ratings.push(r)
  })
  return { ratings, links }
}
