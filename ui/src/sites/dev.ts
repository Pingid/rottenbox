import type { SiteAdapter } from './types'

/** Fixture used when running `vite dev` on localhost. */
export const devSite: SiteAdapter = {
  id: 'dev',
  match: (url) => url.hostname === 'localhost',
  getMedia: () => ({ title: 'Dune: Part Two', year: '2024', type: 'movie' }),
}
