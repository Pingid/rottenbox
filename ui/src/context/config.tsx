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

export type Rect = { x: number; y: number; w: number; h: number }

/**
 * Something offered on each torrent row: a url template, either opened as a
 * link (`LINK`: magnet, player, site) or sent as an http request (e.g. "add
 * to my download client").
 */
export type Action = {
  id: string
  label: string
  /** `LINK` opens the url; anything else is the http method to send it with */
  method: Method
  url: string
  /** requests only: one `Key: Value` per line */
  headers: string
  /** requests only */
  body: string
}

/** A Stremio addon queried for torrent streams. */
export type StreamProvider = {
  id: string
  label: string
  /** addon base url; a pasted manifest or `stremio://` link also works */
  url: string
  enabled: boolean
}

export type Config = {
  open: boolean
  /** panel position/size; unset = default bottom-right placement */
  rect?: Rect
  /** quality filter group, e.g. "1080p"; "all" shows everything */
  quality: string
  /** link / request templates, see `PLACEHOLDERS` */
  actions: Action[]
  /** stream addons, queried in order; earlier ones win on duplicate torrents */
  providers: StreamProvider[]
}

export const PLACEHOLDERS = [
  'magnet',
  'hash',
  'name',
  'title',
  'year',
  'type',
  'imdb',
  'id',
  'season',
  'episode',
  'fileIdx',
] as const

export type Vars = Partial<Record<(typeof PLACEHOLDERS)[number], string | undefined>>

export const METHODS = ['LINK', 'POST', 'PUT', 'PATCH', 'GET', 'DELETE'] as const
export type Method = (typeof METHODS)[number]

export const isLink = (a: Action) => a.method === 'LINK'

export const newAction = (id: string, a: Partial<Action> = {}): Action => ({
  id,
  label: '',
  method: 'LINK',
  url: '',
  headers: '',
  body: '',
  ...a,
})

export const DEFAULT_ACTIONS: Action[] = [
  newAction('magnet', { label: 'Magnet', url: 'magnet:?xt=urn:btih:{hash}&dn={name}' }),
  // `{id}` is the video: the imdb id for movies, `{imdb}:{season}:{episode}` for series
  newAction('stremio', { label: 'Watch', url: 'stremio:///detail/{type}/{imdb}/{id}' }),
]

export const DEFAULT_PROVIDERS: StreamProvider[] = [
  {
    id: 'torrentio',
    label: 'Torrentio',
    url: 'https://torrentio.strem.fun',
    enabled: true,
  },
]

const DEFAULTS: Config = {
  open: true,
  actions: DEFAULT_ACTIONS,
  providers: DEFAULT_PROVIDERS,
  quality: 'all',
}

/** Replace `{name}` (or `{{name}}`) placeholders; unknown names are left as-is. */
export const fillTemplate = (tpl: string, vars: Vars, encode: (v: string) => string = encodeURIComponent) =>
  tpl.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (m, a?: string, b?: string) => {
    const k = (a ?? b) as keyof Vars
    return k in vars ? encode(vars[k] ?? '') : m
  })

/** Escape body values to suit the content type, so `{"m":"{magnet}"}` stays valid json. */
const bodyEncoder = (type: string): ((v: string) => string) =>
  type.includes('json')
    ? (v) => JSON.stringify(v).slice(1, -1)
    : type.includes('x-www-form-urlencoded')
      ? encodeURIComponent
      : (v) => v

const isJson = (tpl: string) => {
  try {
    JSON.parse(tpl.replace(/\{\{\w+\}\}|\{\w+\}/g, ''))
    return true
  } catch {
    return false
  }
}

/** Resolve an action's templates into fetch arguments. */
export const buildRequest = (a: Action, vars: Vars) => {
  const headers: Record<string, string> = {}
  for (const line of a.headers.split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) headers[line.slice(0, i).trim()] = fillTemplate(line.slice(i + 1).trim(), vars, (v) => v)
  }
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

const KEY = 'torrenty:config'

const isRect = (r: unknown): r is Rect =>
  !!r && typeof r === 'object' && (['x', 'y', 'w', 'h'] as const).every((k) => Number.isFinite((r as Rect)[k]))

const isAction = (a: any): a is Action => !!a && typeof a.id === 'string' && METHODS.includes(a.method)

/**
 * Saved actions, migrating configs from before links and requests were merged
 * (separate `links: {url}[]` and `actions: {method, …}[]` lists).
 */
export const loadActions = (saved: any): Action[] => {
  if (!Array.isArray(saved.actions) && !Array.isArray(saved.links)) return DEFAULTS.actions
  const links = Array.isArray(saved.links) ? saved.links : []
  const actions = Array.isArray(saved.actions) ? saved.actions : []
  return [...links.map((l: any) => ({ ...l, method: 'LINK' })), ...actions]
    .filter((a) => a && typeof a.id === 'string')
    .map((a) => newAction(a.id, { ...a, method: isAction(a) ? a.method : 'POST' }))
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** Saved providers with a url, filling any missing fields. */
export const loadProviders = (saved: any): StreamProvider[] => {
  if (!Array.isArray(saved.providers)) return DEFAULTS.providers
  return saved.providers
    .filter((p: any) => p && typeof p.url === 'string')
    .map((p: any) => ({
      id: typeof p.id === 'string' ? p.id : newId(),
      label: typeof p.label === 'string' ? p.label : '',
      url: p.url,
      enabled: p.enabled !== false,
    }))
}

const load = async (s: Persist.AsyncStorage): Promise<Config> => {
  try {
    const saved = (await s.get(KEY)) ?? {}
    // cloned: the store edits these arrays in place, which would mutate the defaults
    return structuredClone({
      open: saved.open ?? DEFAULTS.open,
      rect: isRect(saved.rect) ? saved.rect : undefined,
      quality: typeof saved.quality === 'string' ? saved.quality : DEFAULTS.quality,
      actions: loadActions(saved),
      providers: loadProviders(saved),
    })
  } catch {
    return structuredClone(DEFAULTS)
  }
}

const ConfigContext = createContext<ConfigCtx>()
export const Provider: ParentComponent<{ storage?: Persist.AsyncStorage }> = (p) => {
  const storage = p.storage ?? Persist.use()
  const [loaded] = createResource(() => load(storage))
  const [config, setConfig] = createStore(DEFAULTS)

  const changed = createDebounced(500, () => {
    const c = {
      ...config,
      rect: config.rect && { ...config.rect },
      actions: config.actions.map((x) => ({ ...x })),
      providers: config.providers.map((x) => ({ ...x })),
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
