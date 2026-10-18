import { Page, RT, Ratings, type Rating } from '../../lib'

import type { ListItem, Media, SiteAdapter } from '../types'

/** `/m/slug` or `/tv/slug` from any href, even behind a proxy path prefix. */
const mediaPath = (href: string) => href.match(/\/(m|tv)\/[^/?#]+/)?.[0]

const toMedia = (item: RT.MediaPageItem): Media => {
  if (item['@type'] === 'Movie')
    return {
      title: item.name,
      year: item.dateCreated?.slice(0, 4),
      type: 'movie',
      poster: item.image,
    }
  // season / episode pages describe themselves; the show is `partOfSeries`
  const series = item['@type'] === 'TVSeries' ? undefined : item.partOfSeries
  // the item's own url says which season / episode the page is scoped to
  const [, season, episode] = item.url?.match(/\/tv\/[^/]+\/s(\d+)(?:\/e(\d+))?/) ?? []
  return {
    title: series?.name ?? item.name,
    year: (series?.startDate ?? item.dateCreated)?.slice(0, 4),
    type: 'series',
    poster: item.image,
    season: season ? Number(season) : undefined,
    episode: episode ? Number(episode) : undefined,
  }
}

/** Set on our mount element, so a tile counts as decorated only while the mount is in it. */
const MOUNT = 'data-rottenbox'
/** Set on tiles with nothing to decorate, so they aren't rescanned on every DOM change. */
const SKIP = 'data-rottenbox-skip'

/** ld+json list entries keyed by path, used to fill in years for tiles. */
const listIndex = (doc: Document) => {
  const map = new Map<string, RT.MediaListItem>()
  for (const d of RT.getData(doc)) {
    if (d['@type'] !== 'ItemList') continue
    for (const item of d.itemListElement?.itemListElement ?? []) {
      const path = mediaPath(item.url)
      if (path) map.set(path, item)
    }
  }
  return map
}

type Score = { score?: string; title?: string; reviewCount?: number; ratingCount?: number; reviewsPageUrl?: string }

/** The page's scorecard json: both meters, with counts. */
const scorecard = (doc: Document) => {
  try {
    const text = doc.querySelector('script#media-scorecard-json')?.textContent
    return text ? (JSON.parse(text) as { criticsScore?: Score; audienceScore?: Score }) : null
  } catch {
    return null
  }
}

const meter = (id: string, label: string, s: Score | undefined): Rating | null =>
  s
    ? Ratings.from({
        id,
        label: s.title || label,
        value: s.score,
        max: 100,
        format: 'percent',
        count: s.ratingCount ?? s.reviewCount,
        url: s.reviewsPageUrl && new URL(s.reviewsPageUrl, location.href).href,
      })
    : null

export const rottenTomatoes: SiteAdapter = {
  id: 'rottentomatoes',
  match: (url) => /(^|\.)rottentomatoes\.com$/.test(url.hostname),
  fingerprint: (doc) =>
    Page.names(doc).some((n) => n === 'rotten tomatoes' || n === 'rottentomatoes') ||
    !!doc.querySelector('rt-header, media-info-tile'),
  // only detail pages carry a Movie / TV* ld+json item
  getMedia: (doc) => {
    const item = RT.getMediaItem(doc)
    return item ? toMedia(item) : null
  },
  getRatings: (doc) => {
    const card = scorecard(doc)
    // ld+json only has the Tomatometer; it's the fallback when the scorecard markup changes
    const ld = RT.getMediaItem(doc)?.aggregateRating
    return Ratings.dedupe([
      meter('tomatometer', 'Tomatometer', card?.criticsScore),
      ld &&
        Ratings.from({
          id: 'tomatometer',
          label: 'Tomatometer',
          value: ld.ratingValue,
          max: 100,
          format: 'percent',
          count: ld.ratingCount ?? ld.reviewCount,
        }),
      meter('popcornmeter', 'Popcornmeter', card?.audienceScore),
    ])
  },
  listItems: (doc) => {
    const tiles = [...doc.querySelectorAll(`media-info-tile:not([${SKIP}])`)].filter(
      (tile) => !tile.querySelector(`:scope > [${MOUNT}]`),
    )
    if (!tiles.length) return []
    const index = listIndex(doc)
    const items: ListItem[] = []
    for (const tile of tiles) {
      const skip = () => tile.setAttribute(SKIP, '')
      const link = tile.querySelector<HTMLAnchorElement>('a[href]')
      const path = link && mediaPath(link.href)
      if (!path) {
        skip()
        continue
      }
      const known = index.get(path)
      const title = tile.querySelector('[data-qa="discovery-media-list-item-title"]')?.textContent?.trim()
      const media = known
        ? toMedia(known)
        : title
          ? {
              title,
              type: path.startsWith('/tv/') ? ('series' as const) : ('movie' as const),
            }
          : null
      if (!media) {
        skip()
        continue
      }
      // `image-banner` sits inside the tile's relatively positioned poster-wrap.
      const el = doc.createElement('span')
      el.slot = 'image-banner'
      el.setAttribute(MOUNT, '')
      // RT styles this slot with `left: 0`, so override it to pin top-right.
      el.style.cssText = 'position:absolute;top:6px;left:auto;right:6px;z-index:2'
      tile.appendChild(el)
      items.push({ el, media })
    }
    return items
  },
}
