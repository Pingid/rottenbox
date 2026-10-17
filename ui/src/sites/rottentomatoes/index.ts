import { Page, RT } from '../../lib'

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
const MOUNT = 'data-torrenty'
/** Set on tiles with nothing to decorate, so they aren't rescanned on every DOM change. */
const SKIP = 'data-torrenty-skip'

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
