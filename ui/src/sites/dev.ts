import type { SiteAdapter } from './types'

/** Fixture used when running `vite dev` on localhost. */
export const devSite: SiteAdapter = {
  id: 'dev',
  match: (url) => url.hostname === 'localhost',
  getMedia: () => ({ title: 'Dune: Part Two', year: '2024', type: 'movie' }),
  getRatings: () => [
    { id: 'tomatometer', label: 'Tomatometer', value: 92, max: 100, format: 'percent', count: 466 },
    { id: 'popcornmeter', label: 'Popcornmeter', value: 95, max: 100, format: 'percent', count: 2244 },
  ],
}
