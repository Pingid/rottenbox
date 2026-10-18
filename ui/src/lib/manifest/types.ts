/**
 * Something offered on each stream row: a url template, either opened as a
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

export const METHODS = ['LINK', 'POST', 'PUT', 'PATCH', 'GET', 'DELETE'] as const
export type Method = (typeof METHODS)[number]

/** One url template in a links source, e.g. a streaming service's search page. */
export type Link = { id: string; label: string; url: string }

type Base = { id: string; label: string; enabled: boolean }

/** A Stremio addon, queried for streams of any kind (torrent, http, external). */
export type StremioSource = Base & {
  kind: 'stremio'
  /** addon base url; a pasted manifest or `stremio://` link also works */
  url: string
}

/** A group of url templates shown as chips, e.g. "Watch on". */
export type LinksSource = Base & {
  kind: 'links'
  links: Link[]
}

/**
 * Dot paths (`a.b.0.c`) into an http source's json response. `items` picks a
 * list (each entry is mapped on its own); without it the whole response is one
 * entry. `max` is a number or a path; ratings default to 10.
 */
export type HttpMap = {
  items: string
  value: string
  max: string
  label: string
  url: string
}

/** A json endpoint whose response is mapped to ratings or links. */
export type HttpSource = Base & {
  kind: 'http'
  url: string
  /** one `Key: Value` per line */
  headers: string
  produces: 'rating' | 'links'
  map: HttpMap
}

export type Source = StremioSource | LinksSource | HttpSource
export type Kind = Source['kind']
export const KINDS: Kind[] = ['stremio', 'links', 'http']

/**
 * The one json shape for saved settings, backups and shareable packs. Packs
 * usually carry just `name` and `sources`; backups add `actions`, `theme`
 * and `quality`.
 */
export type Manifest = {
  app: 'rottenbox'
  version: typeof VERSION
  name?: string
  sources: Source[]
  actions?: Action[]
  theme?: string
  quality?: string
}

export const VERSION = 2
