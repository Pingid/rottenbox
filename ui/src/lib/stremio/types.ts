export interface BehaviorHints {
  bingeGroup?: string
  filename?: string
  [key: string]: unknown
}

export interface Stream {
  name: string
  title: string
  /** absent on http/debrid streams, which some addons mix in */
  infoHash?: string
  url?: string
  fileIdx?: number
  behaviorHints?: BehaviorHints
  sources?: string[]
}

export interface StreamResponse {
  streams: Stream[]
  cacheMaxAge?: number
  staleRevalidate?: number
  staleError?: number
}
