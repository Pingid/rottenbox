export type SchemaOrgPayload =
  | ItemListRoot
  | (Movie & SchemaContext)
  | (TVSeries & SchemaContext)
  | (TVSeasonPage & SchemaContext)
  | (TVEpisodePage & SchemaContext)

export interface SchemaContext {
  '@context'?: string
}

export interface AggregateRating {
  '@type': 'AggregateRating'
  name: string
  bestRating: string
  worstRating: string
  ratingValue: string
  reviewCount: number
  ratingCount?: number
  description?: string
}

export interface VideoObject {
  '@type': 'VideoObject'
  name: string
  thumbnailUrl: string
  duration: string
  sourceOrganization: string
  uploadDate: string
  description: string
  contentUrl: string
}

export interface Person {
  '@type': 'Person'
  name: string
  sameAs: string
  image?: string
}

export interface TVSeason {
  '@type': 'TVSeason'
  name: string
  url: string
}

export interface TVSeriesRef {
  '@type': 'TVSeries'
  name: string
  startDate?: string
  url: string
}

export interface BaseMediaItem {
  name: string
  url: string
  image: string
  dateCreated: string
  description?: string
  aggregateRating?: AggregateRating
  video?: VideoObject
  position?: number
}

export interface Movie extends BaseMediaItem {
  '@type': 'Movie'
  director?: Person[]
  contentRating?: string
  genre?: string[]
}

export interface TVSeries extends BaseMediaItem {
  '@type': 'TVSeries'
  actor?: Person[]
  producer?: Person[]
  containsSeason?: TVSeason[]
  partOfSeries?: TVSeriesRef
  contentRating?: string
  genre?: string[]
  numberOfSeasons?: number
}

export interface TVSeasonPage extends BaseMediaItem {
  '@type': 'TVSeason'
  partOfSeries: TVSeriesRef
  numberOfEpisodes?: number
}

export interface TVEpisodePage extends BaseMediaItem {
  '@type': 'TVEpisode'
  partOfSeries: TVSeriesRef
  partOfSeason?: TVSeason & { seasonNumber?: string }
}

export type MediaListItem = Movie | TVSeries

/** Anything a detail page can be about. */
export type MediaPageItem = MediaListItem | TVSeasonPage | TVEpisodePage

export interface ItemListNested {
  '@type': 'ItemList'
  name: string
  itemListElement: MediaListItem[]
}

export interface ItemListRoot extends SchemaContext {
  '@type': 'ItemList'
  url: string
  name: string
  description?: string
  itemListElement: ItemListNested
}
