export interface BehaviorHints {
  bingeGroup?: string
  filename?: string
  [key: string]: unknown
}

export interface Stream {
  name?: string
  /** older addons put the details here; newer ones use `description` */
  title?: string
  description?: string
  /** torrent streams */
  infoHash?: string
  fileIdx?: number
  sources?: string[]
  /** http / debrid streams */
  url?: string
  /** opened in a browser, not played */
  externalUrl?: string
  ytId?: string
  behaviorHints?: BehaviorHints
}

export interface StreamResponse {
  streams: Stream[]
  cacheMaxAge?: number
  staleRevalidate?: number
  staleError?: number
}

export type Resource = string | { name: string; types?: string[]; idPrefixes?: string[] }

/** `GET {base}/manifest.json`: what the addon offers, for which content types and ids. */
export interface AddonManifest {
  id: string
  name: string
  version: string
  description?: string
  resources: Resource[]
  types: string[]
  idPrefixes?: string[]
}
