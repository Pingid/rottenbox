import { queryOptions } from '@tanstack/solid-query'

import { Http, Time } from '../util'

import type { MetaCatalogResponse, MetaDetail, MetaResponse } from './types'

export * from './types'

const BASE = 'https://v3-cinemeta.strem.io'

export type Type = 'movie' | 'series'

export type SearchParams = { query: string; year?: string; type?: Type }

export const search = (p: SearchParams) => {
  const qry = new URLSearchParams()
  qry.set('search', p.query)
  if (p.year) qry.set('year', p.year)
  return Http.json<MetaCatalogResponse>(`${BASE}/catalog/${p.type ?? 'movie'}/top/${qry.toString()}.json`)
}

/** Prefer the result released in `year`, else the top-ranked one. */
export const pickBest = (metas: MetaDetail[], year?: string) =>
  (year && metas.find((m) => (m.releaseInfo ?? m.year ?? '').startsWith(year))) || metas[0]

/** Full metadata, including `videos` (episodes) for series. Unknown ids 404. */
export const meta = (type: Type, id: string) =>
  Http.json<MetaResponse>(`${BASE}/meta/${type}/${id}.json`).then((x) => x.meta)

export const queries = {
  /** Title search. Results for a title rarely move, so keep them for a week. */
  search: (p: SearchParams) =>
    queryOptions({
      queryKey: ['cinemeta', 'search', p.type ?? 'movie', p.query, p.year ?? ''] as const,
      queryFn: () => search(p).then((r) => r.metas ?? []),
      staleTime: 7 * Time.day,
      gcTime: 30 * Time.day,
    }),
  /**
   * Metadata by IMDb id. Movies and ended shows are effectively immutable;
   * running shows gain episodes, so recheck those daily.
   */
  meta: (type: Type, id: string) =>
    queryOptions({
      queryKey: ['cinemeta', 'meta', type, id] as const,
      queryFn: () => meta(type, id),
      staleTime: (q) => (type === 'series' && q.state.data?.status !== 'Ended' ? Time.day : 30 * Time.day),
      gcTime: 30 * Time.day,
    }),
}
