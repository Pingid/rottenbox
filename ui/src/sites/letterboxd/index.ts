import { LdJson, Page } from '../../lib'

import type { ListItem, Media, SiteAdapter } from '../types'

const MOUNT = 'data-torrenty'

/** "Interstellar (2014)" -> { title, year } */
const parseName = (name: string) => {
  const m = name.match(/^(.*) \((\d{4})\)$/)
  return m ? { title: m[1], year: m[2] } : { title: name }
}

type LdMovie = {
  '@type': 'Movie'
  name: string
  dateCreated?: string
  image?: string
}

export const letterboxd: SiteAdapter = {
  id: 'letterboxd',
  match: (url) => /(^|\.)letterboxd\.com$/.test(url.hostname),
  fingerprint: (doc) =>
    Page.names(doc).includes('letterboxd') || !!doc.querySelector('[data-component-class="LazyPoster"]'),
  // only film pages carry a Movie ld+json item
  getMedia: (doc) => {
    const movie = LdJson.read(doc).find((x): x is LdMovie => (x as LdMovie)?.['@type'] === 'Movie')
    if (!movie) return null
    const imdb = doc.querySelector<HTMLAnchorElement>('a[data-track-action="IMDb"]')?.href.match(/tt\d+/)?.[0]
    return {
      title: movie.name,
      year: movie.dateCreated?.slice(0, 4),
      // Letterboxd also lists some miniseries
      type: doc.body.dataset.tmdbType === 'tv' ? 'series' : 'movie',
      poster: movie.image,
      imdb,
    } satisfies Media
  },
  listItems: (doc) => {
    const items: ListItem[] = []
    const posters = doc.querySelectorAll<HTMLElement>('[data-component-class="LazyPoster"][data-item-name]')
    for (const poster of posters) {
      // React may re-render the poster and drop our mount, so check for the
      // mount itself rather than marking the poster.
      const frame = poster.querySelector<HTMLElement>('.film-poster')
      if (!frame || frame.querySelector(`[${MOUNT}]`)) continue
      const el = doc.createElement('span')
      el.setAttribute(MOUNT, '')
      el.style.cssText = 'position:absolute;top:3px;right:3px;z-index:2'
      frame.appendChild(el)
      items.push({
        el,
        compact: true,
        media: { ...parseName(poster.dataset.itemName!), type: 'movie' },
      })
    }
    return items
  },
}
