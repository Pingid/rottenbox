import { LdJson, Page, Ratings } from '../../lib'

import type { ListItem, Media, SiteAdapter } from '../types'

const MOUNT = 'data-rottenbox'

/** `/movie/slug/`, `/tv/slug/` or `/tv/slug/season-2/`; games and music live elsewhere. */
const MEDIA_PATH = /^\/(movie|tv)\/([^/]+)\/(?:season-(\d+)\/)?$/

type LdItem = {
  '@type': 'Movie' | 'TVSeries' | 'TVSeason'
  name: string
  url?: string
  dateCreated?: string
  image?: string
  /** TVSeason only */
  seasonNumber?: number
  partOfSeries?: { name: string }
  aggregateRating?: { ratingValue?: number; bestRating?: number; reviewCount?: number; url?: string }
}

const isItem = (x: unknown): x is LdItem => ['Movie', 'TVSeries', 'TVSeason'].includes((x as LdItem)?.['@type'])

const samePath = (url: string) => {
  try {
    return new URL(url, location.href).pathname === location.pathname
  } catch {
    return false
  }
}

/** "The Diplomat (2023): Season 4" -> { title: 'The Diplomat', year: '2023', season: 4 } */
const parseName = (alt: string) => {
  const [, rest = alt, season] = alt.match(/^(.*?):\s*Season (\d+)$/i) ?? []
  const [, title = rest, year] = rest.match(/^(.*) \((\d{4})\)$/) ?? []
  return { title: title.trim(), year, season: season ? Number(season) : undefined }
}

/** The ld+json item for this page, ignoring one left over from the previous page. */
const pageItem = (doc: Document) => {
  const item = LdJson.read(doc).find(isItem)
  // navigation is client-side and the ld+json is swapped in after the url
  // changes, so ignore an item still describing the previous page
  return item && (!item.url || samePath(item.url)) ? item : null
}

export const metacritic: SiteAdapter = {
  id: 'metacritic',
  match: (url) => /(^|\.)metacritic\.com$/.test(url.hostname),
  fingerprint: (doc) => Page.names(doc).includes('metacritic'),
  getMedia: (doc) => {
    const item = pageItem(doc)
    if (!item) return null
    const year = item.dateCreated?.slice(0, 4)
    if (item['@type'] === 'Movie') return { title: item.name, year, type: 'movie', poster: item.image }
    if (item['@type'] === 'TVSeries') return { title: item.name, year, type: 'series', poster: item.image }
    return {
      title: item.partOfSeries?.name ?? item.name,
      year,
      type: 'series',
      poster: item.image,
      season: item.seasonNumber,
    } satisfies Media
  },
  getRatings: (doc) => {
    const r = pageItem(doc)?.aggregateRating
    const rating =
      r &&
      Ratings.from({
        id: 'metascore',
        label: 'Metascore',
        value: r.ratingValue,
        max: r.bestRating ?? 100,
        count: r.reviewCount,
        url: r.url,
      })
    return rating ? [rating] : []
  },
  listItems: (doc) => {
    const items: ListItem[] = []
    for (const link of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const [, kind, slug] = link.getAttribute('href')!.match(MEDIA_PATH) ?? []
      // the poster's aspect-ratio box (present even when the image is a placeholder) is
      // positioned, so the button can pin to its corner; text-only links have none
      const box = kind ? link.querySelector<HTMLElement>('[style*="aspect-ratio"]') : null
      if (!box) continue
      // Vue may re-render the card, so check for the mount itself rather than marking it
      if (box.querySelector(`:scope > [${MOUNT}]`)) continue
      // the poster's alt is the clean title; the heading carries a rank on browse pages ("1. Rear Window")
      const name =
        box.querySelector('img')?.alt ||
        link
          .querySelector('h3, [data-testid="product-title"]')
          ?.textContent?.trim()
          .replace(/^\d+\.\s*/, '')
      if (!name) continue
      const el = doc.createElement('span')
      el.setAttribute(MOUNT, '')
      el.style.cssText = 'position:absolute;top:6px;right:6px;z-index:2'
      box.appendChild(el)

      const { title, year, season } = parseName(name)
      items.push({
        el,
        compact: box.getBoundingClientRect().width < 100,
        media: {
          title,
          year:
            year ??
            // browse cards show the release date: "Sep 1, 1954"
            link.textContent?.match(/[A-Z][a-z]{2} \d{1,2}, ((?:19|20)\d{2})\b/)?.[1] ??
            // slugs of same-named titles end in their year: `street-fighter-2026`
            slug.match(/-((?:19|20)\d{2})$/)?.[1],
          type: kind === 'tv' ? 'series' : 'movie',
          season,
        },
      })
    }
    return items
  },
}
