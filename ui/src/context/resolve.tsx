import { createMemo, createSignal } from 'solid-js'

import { IMDB } from '../lib'
import type { Media } from '../sites'

import * as Config from './config'
import * as Fetch from './fetch'
import * as Query from './query'

/**
 * The page's title matched to a Cinemeta (IMDb) entry, plus the picked
 * episode for series. Called once per panel and shared by its views, so they
 * agree on the match and the episode.
 */
export const use = (media: () => Media) => {
  const r = Fetch.use()

  // by IMDb id when the site gives one, else (or if the id is unknown) by title search
  const byId = Query.use(() => ({
    ...IMDB.queries.meta(r, media().type, media().imdb ?? ''),
    enabled: !!media().imdb,
  }))
  const search = Query.use(() => ({
    ...IMDB.queries.search(r, { query: media().title, year: media().year, type: media().type }),
    enabled: !media().imdb || byId.isError,
  }))
  const metas = () => (byId.data ? [byId.data] : (search.data ?? []))

  const [metaId, setMetaId] = createSignal<string>()
  const meta = () => {
    const list = metas()
    return list.find((m) => m.id === metaId()) ?? IMDB.pickBest(list, media().year)
  }

  // full metadata for the match: search results carry no rating, and series need
  // their episode list (same query as `byId` when the site gave the id)
  const isSeries = () => media().type === 'series'
  const details = Query.use(() => ({
    ...IMDB.queries.meta(r, media().type, meta()?.id ?? ''),
    enabled: !!meta(),
  }))
  /** The match with full metadata once loaded, else the search entry. */
  const detail = () => (details.data?.id === meta()?.id ? details.data : undefined) ?? meta()
  const videos = createMemo(() => IMDB.sortVideos(details.data?.videos))
  const [pick, setPick] = createSignal({ season: media().season ?? 1, episode: media().episode })
  /** Picked episode, falling back to the season's first, then the show's first. */
  const video = createMemo(() => {
    const { season, episode } = pick()
    const v = videos()
    return (
      v.find((x) => x.season === season && x.episode === episode) ??
      v.find((x) => x.season === season) ??
      v.find((x) => x.season > 0) ??
      v[0]
    )
  })

  /** Stremio video id: the imdb id for movies, `{imdb}:{season}:{episode}` for series. */
  const videoId = () => (isSeries() ? video()?.id : meta()?.id)

  /** Template values that don't depend on a particular stream. */
  const vars = (): Config.Vars => ({
    title: media().title,
    year: media().year,
    type: media().type,
    imdb: meta()?.id,
    id: videoId(),
    season: video()?.season.toString(),
    episode: video()?.episode.toString(),
  })

  const loading = () => byId.isLoading || search.isLoading || details.isLoading
  // a failed id lookup falls back to search, so only search's own failure counts
  const error = () => search.isError || details.isError

  return {
    metas,
    meta,
    detail,
    setMetaId,
    isSeries,
    videos,
    video,
    setPick,
    videoId,
    vars,
    loading,
    error,
    /** for retry / failure messages, named for the user; `fallback` failures aren't shown */
    queries: () => [
      { name: 'Cinemeta', q: byId, fallback: true },
      { name: 'Cinemeta', q: search, fallback: false },
      { name: 'Cinemeta', q: details, fallback: false },
    ],
  }
}

export type Resolved = ReturnType<typeof use>
