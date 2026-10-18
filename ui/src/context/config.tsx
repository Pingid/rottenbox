import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentComponent,
} from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'

import * as Persist from './persist'

import { Manifest } from '../lib'

export type Rect = { x: number; y: number; w: number; h: number }

export type Action = Manifest.Action
export type Method = Manifest.Method
export type Source = Manifest.Source
export const METHODS = Manifest.METHODS
export const newAction = Manifest.newAction
export const newId = Manifest.newId

export type Tab = 'overview' | 'streams'

export type Config = {
  open: boolean
  /** panel position/size; unset = default bottom-right placement */
  rect?: Rect
  /** which panel view was last open */
  tab: Tab
  /** quality filter group, e.g. "1080p"; "all" shows everything */
  quality: string
  /** link / request templates on stream rows, see `PLACEHOLDERS` */
  actions: Action[]
  /** where ratings, links and streams come from; stremio addons are queried in order */
  sources: Source[]
}

export const PLACEHOLDERS = [
  'title',
  'year',
  'type',
  'imdb',
  'id',
  'season',
  'episode',
  'magnet',
  'hash',
  'name',
  'fileIdx',
  'url',
] as const

export type Vars = Partial<Record<(typeof PLACEHOLDERS)[number], string | undefined>>

export const isLink = (a: Action) => a.method === 'LINK'

export const DEFAULT_ACTIONS: Action[] = [
  newAction('magnet', { label: 'Magnet', url: '{magnet}' }),
  newAction('open', { label: 'Open', url: '{url}' }),
  // `{id}` is the video: the imdb id for movies, `{imdb}:{season}:{episode}` for series
  newAction('stremio', { label: 'Stremio', url: 'stremio:///detail/{type}/{imdb}/{id}' }),
]

const links = (id: string, label: string, entries: [string, string][]): Manifest.LinksSource => ({
  kind: 'links',
  id,
  label,
  enabled: true,
  links: entries.map(([label, url]) => ({ id: label.toLowerCase().replace(/\W+/g, '-'), label, url })),
})

export const DEFAULT_SOURCES: Source[] = [
  links('watch', 'Watch on', [
    ['JustWatch', 'https://www.justwatch.com/us/search?q={title}'],
    ['Netflix', 'https://www.netflix.com/search?q={title}'],
    ['Prime Video', 'https://www.primevideo.com/search?phrase={title}'],
    ['Disney+', 'https://www.disneyplus.com/search?q={title}'],
    ['Apple TV', 'https://tv.apple.com/search?term={title}'],
    ['HBO Max', 'https://play.hbomax.com/search?q={title}'],
  ]),
  links('elsewhere', 'Elsewhere', [
    ['IMDb', 'https://www.imdb.com/title/{imdb}/'],
    ['Letterboxd', 'https://letterboxd.com/imdb/{imdb}/'],
    ['Rotten Tomatoes', 'https://www.rottentomatoes.com/search?search={title}'],
    ['Metacritic', 'https://www.metacritic.com/search/{title}/'],
    ['Trakt', 'https://trakt.tv/search/imdb/{imdb}'],
  ]),
]

const DEFAULTS: Config = {
  open: true,
  tab: 'overview',
  actions: DEFAULT_ACTIONS,
  sources: DEFAULT_SOURCES,
  quality: 'all',
}

const TEMPLATE = /\{\{(\w+)\}\}|\{(\w+)\}/g

/** Replace `{name}` (or `{{name}}`) placeholders; unknown names are left as-is. */
export const fillTemplate = (tpl: string, vars: Vars, encode: (v: string) => string = encodeURIComponent) =>
  tpl.replace(TEMPLATE, (m, a?: string, b?: string) => {
    const k = (a ?? b) as keyof Vars
    return k in vars ? encode(vars[k] ?? '') : m
  })

/**
 * Whether the template uses a known placeholder that has no value here, e.g.
 * `{magnet}` on an http stream or `{imdb}` before the title is matched. Such
 * links and actions are hidden or disabled rather than sent half-filled.
 */
export const missing = (tpl: string, vars: Vars) =>
  [...tpl.matchAll(TEMPLATE)].some(([, a, b]) => {
    const k = (a ?? b) as keyof Vars
    return k in vars && !vars[k]
  })

/** `Key: Value` lines into a header object, placeholders filled raw. */
export const parseHeaders = (text: string, vars: Vars) => {
  const headers: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) headers[line.slice(0, i).trim()] = fillTemplate(line.slice(i + 1).trim(), vars, (v) => v)
  }
  return headers
}

/** Escape body values to suit the content type, so `{"m":"{magnet}"}` stays valid json. */
const bodyEncoder = (type: string): ((v: string) => string) =>
  type.includes('json')
    ? (v) => JSON.stringify(v).slice(1, -1)
    : type.includes('x-www-form-urlencoded')
      ? encodeURIComponent
      : (v) => v

const isJson = (tpl: string) => {
  try {
    JSON.parse(tpl.replace(TEMPLATE, ''))
    return true
  } catch {
    return false
  }
}

/** Resolve an action's templates into fetch arguments. */
export const buildRequest = (a: Action, vars: Vars) => {
  const headers = parseHeaders(a.headers, vars)
  const hasBody = !!a.body.trim() && a.method !== 'GET'
  const typeKey = Object.keys(headers).find((h) => h.toLowerCase() === 'content-type')
  // guess a content type when none is given: json if it parses with the
  // placeholders blanked (a bare `{{magnet}}` also starts with `{`)
  if (hasBody && !typeKey) headers['Content-Type'] = isJson(a.body) ? 'application/json' : 'text/plain'
  const type = headers[typeKey ?? 'Content-Type'] ?? ''
  return {
    method: a.method,
    url: fillTemplate(a.url, vars),
    headers,
    body: hasBody ? fillTemplate(a.body, vars, bodyEncoder(type)) : undefined,
  }
}

type ConfigCtx = { config: Config; setConfig: SetStoreFunction<Config> }

const KEY = 'rottenbox:config'

const isRect = (r: unknown): r is Rect =>
  !!r && typeof r === 'object' && (['x', 'y', 'w', 'h'] as const).every((k) => Number.isFinite((r as Rect)[k]))

const load = async (s: Persist.AsyncStorage): Promise<Config> => {
  try {
    const saved = (await s.get(KEY)) ?? {}
    // cloned: the store edits these arrays in place, which would mutate the defaults
    return structuredClone({
      open: saved.open ?? DEFAULTS.open,
      rect: isRect(saved.rect) ? saved.rect : undefined,
      tab: saved.tab === 'streams' ? 'streams' : 'overview',
      quality: typeof saved.quality === 'string' ? saved.quality : DEFAULTS.quality,
      actions: Array.isArray(saved.actions) ? Manifest.actions(saved.actions) : DEFAULTS.actions,
      sources: Array.isArray(saved.sources) ? Manifest.sources(saved.sources) : DEFAULTS.sources,
    })
  } catch {
    return structuredClone(DEFAULTS)
  }
}

const ConfigContext = createContext<ConfigCtx>()
export const Provider: ParentComponent<{ storage?: Persist.AsyncStorage }> = (p) => {
  const storage = p.storage ?? Persist.use()
  const [loaded] = createResource(() => load(storage))
  const [config, setConfig] = createStore(structuredClone(DEFAULTS))

  const changed = createDebounced(500, () => {
    const c = {
      ...config,
      rect: config.rect && { ...config.rect },
      // json round-trip reads every nested field through the store, so edits deep in a
      // source (a link's url) are tracked too, and yields plain copies of the proxies
      actions: JSON.parse(JSON.stringify(config.actions)) as Action[],
      sources: JSON.parse(JSON.stringify(config.sources)) as Source[],
    }
    if (!loaded()) return undefined
    return c
  })

  const [] = createResource(changed, (c) => {
    if (!c) return Promise.resolve()
    return storage.set(KEY, c)
  })

  createEffect(() => {
    const l = loaded()
    if (!l) return
    setConfig(l)
  })

  return <ConfigContext.Provider value={{ config, setConfig }}>{p.children}</ConfigContext.Provider>
}

export const use = () => {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('Config.Provider missing')
  return ctx
}

const createDebounced = <T,>(delay: number, fn: () => T): Accessor<T> => {
  const [value, setValue] = createSignal<T>(fn())
  createEffect(() => {
    const next = fn()
    const timer = setTimeout(() => setValue(() => next), delay)
    onCleanup(() => clearTimeout(timer))
  })
  return value
}
