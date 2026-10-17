export interface MetaCatalogResponse {
  query: string
  rank: number
  cacheMaxAge: number
  metas: MetaDetail[]
}

export type MetaType = 'movie' | 'series' | 'channel' | 'tv'

export interface MetaBehaviorHints {
  defaultVideoId?: string
  hasScheduledVideos?: boolean
}

export interface MetaPopularities {
  trakt?: number
  moviedb?: number
  stremio?: number
  stremio_lib?: number
}

export interface MetaLink {
  name: string
  category: string
  url: string
}

export interface MetaDetail {
  id: string
  imdb_id?: string
  type: MetaType | string
  name: string
  poster?: string
  background?: string
  logo?: string
  releaseInfo?: string
  year?: string
  released?: string
  runtime?: string
  description?: string
  genre?: string[]
  genres?: string[]
  director?: string[]
  writer?: string[]
  cast?: string[]
  imdbRating?: string
  score?: number
  popularity?: number
  popularities?: MetaPopularities
  slug?: string
  links?: MetaLink[]
  behaviorHints?: MetaBehaviorHints
  awards?: string | null
  dvdRelease?: string | null
  trailers?: unknown[]
  trailerStreams?: unknown[]
  /** series only, e.g. "Continuing" | "Ended" */
  status?: string
  /** series only, from the meta endpoint */
  videos?: MetaVideo[]
}

export interface MetaVideo {
  /** `{imdb}:{season}:{episode}` */
  id: string
  season: number
  episode: number
  name?: string
  released?: string
}

export interface MetaResponse {
  meta: MetaDetail
}
