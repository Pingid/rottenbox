export type Media = {
  title: string
  year?: string
  type: 'movie' | 'series'
  poster?: string
  /** IMDb id when the site links it; skips the title search */
  imdb?: string
  /** series pages scoped to a season / episode */
  season?: number
  episode?: number
}

export type ListItem = {
  /** Element the adapter inserted into the page; the item button renders inside it. */
  el: HTMLElement
  media: Media
  /** smaller button, for small posters */
  compact?: boolean
}

/** A site the panel can be injected into. */
export type SiteAdapter = {
  id: string
  /** Whether this adapter handles the given url (location, canonical, og:url). */
  match: (url: URL) => boolean
  /**
   * Markup check for when no url names the site (proxies, mirrors that also
   * rewrite canonical links): declared site name, site-specific elements.
   */
  fingerprint?: (doc: Document) => boolean
  /** Extract the media being viewed, or null if the page has none. */
  getMedia: (doc: Document) => Media | null
  /**
   * Find list entries (e.g. browse grids) not yet decorated, insert a mount
   * element into each and return them. Called again whenever the DOM changes.
   */
  listItems?: (doc: Document) => ListItem[]
}
