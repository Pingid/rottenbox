import { queryOptions } from '@tanstack/solid-query'

import { Http, Time } from '../util'

import type { Stream, StreamResponse } from './types'

export * from './types'

/**
 * Addon base url from whatever the user pasted: a `stremio://` install link,
 * a `…/manifest.json` url, or the base itself.
 */
export const baseUrl = (url: string) =>
  url
    .trim()
    .replace(/^stremio:\/\//i, 'https://')
    .replace(/\/manifest\.json$/i, '')
    .replace(/\/+$/, '')

/** `id` is an imdb id for movies, `{imdb}:{season}:{episode}` for series. */
export const query = (addon: string, type: 'movie' | 'series', id: string) =>
  Http.json<StreamResponse>(`${baseUrl(addon)}/stream/${type}/${id}.json`)

export const queries = {
  /**
   * Parsed torrent streams from one addon. The raw response is what gets
   * cached (`select` runs per observer), so the persisted cache survives
   * parser changes. Freshness follows the addon's own hint (default 1h).
   */
  streams: (addon: string, type: 'movie' | 'series', id: string) =>
    queryOptions({
      queryKey: ['stremio', baseUrl(addon), type, id] as const,
      queryFn: () => query(addon, type, id),
      select: (r) => r.streams.filter(isTorrent).map(parseStream),
      staleTime: (q) => (q.state.data?.cacheMaxAge ?? 3600) * Time.second,
      // Torrentio allows stale-if-error for a week: old results beat none.
      gcTime: 7 * Time.day,
    }),
}

const isTorrent = (s: Stream): s is Stream & { infoHash: string } => !!s.infoHash

/**
 * Combine per-addon results in addon order; the first addon to list a
 * hash/file pair wins, later duplicates are dropped.
 */
export const merge = (results: { provider: string; streams: ParsedStream[] }[]) => {
  const seen = new Set<string>()
  const out: (ParsedStream & { provider: string })[] = []
  for (const { provider, streams } of results)
    for (const s of streams) {
      const key = `${s.hash.toLowerCase()}:${s.fileIdx ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...s, provider })
    }
  return out
}

/**
 * Extracts resolution/quality and parsed file size from a stream title.
 *
 * @param {string} title - The stream title string
 * @returns {{ quality: string | null, size: { raw: string, bytes: number } | null }}
 */
export const parseStreamTitle = (title: string) => {
  if (!title || typeof title !== 'string') {
    return { quality: null, size: null }
  }

  // 1. Extract file size (matches: 💾 4.41 GB, 💾 753.45 MB, 💾 8 GB, etc.)
  const sizeMatch = title.match(/💾\s*([\d.]+)\s*(GB|MB|KB|TB|B)/i)
  let size = null

  if (sizeMatch) {
    const rawValue = parseFloat(sizeMatch[1])
    const unit = sizeMatch[2].toUpperCase()
    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    }

    size = {
      raw: `${sizeMatch[1]} ${unit}`,
      bytes: Math.round(rawValue * (multipliers[unit as keyof typeof multipliers] || 1)),
    }
  }

  // 2. Extract resolution / quality (prioritizes standard resolutions down to rip tags)
  const qualityMatch = title.match(
    /\b(2160p|4k|1080p|720p|480p|remux|bdrip|brrip|web-dl|webrip|dvdrip|vhsrip|hdrip)\b/i,
  )
  const quality = qualityMatch ? qualityMatch[1] : null

  return { quality, size }
}

export type ParsedStream = {
  hash: string
  fileIdx?: number
  filename: string
  /** Display label, e.g. "4k DV | HDR" */
  quality: string
  /** Filter bucket, e.g. "4k", "1080p", "other" */
  group: string
  size: string | null
  seeders: number | null
  source: string | null
  /** magnet uri with the stream's trackers */
  magnet: string
}

const GROUPS = ['4k', '2160p', '1080p', '720p', '480p']

/** Magnet uri for a hash; `sources` entries like `tracker:udp://…` become `tr` params. */
export const magnet = (hash: string, name?: string, sources: string[] = []) => {
  // encodeURIComponent, not URLSearchParams: some clients show `+` literally
  const params = [`xt=urn:btih:${hash}`]
  if (name) params.push(`dn=${encodeURIComponent(name)}`)
  for (const src of sources)
    if (src.startsWith('tracker:')) params.push(`tr=${encodeURIComponent(src.slice('tracker:'.length))}`)
  return `magnet:?${params.join('&')}`
}

/**
 * Flatten a torrent stream into display fields. Title parsing follows
 * torrentio's format (💾 size, 👤 seeders, ⚙️ source), which most torrent
 * addons copy; fields an addon doesn't provide come out null.
 */
export const parseStream = (s: Stream & { infoHash: string }): ParsedStream => {
  const { quality, size } = parseStreamTitle(s.title)
  const filename = s.behaviorHints?.filename ?? s.title.split('\n')[0]
  const label = s.name.split('\n')[1]?.trim() || quality || '?'
  const first = label.split(/\s/)[0].toLowerCase()
  return {
    hash: s.infoHash,
    fileIdx: s.fileIdx,
    filename,
    quality: label,
    group: first === '2160p' ? '4k' : GROUPS.includes(first) ? first : 'other',
    size: size?.raw ?? null,
    seeders: Number(s.title.match(/👤\s*(\d+)/)?.[1] ?? NaN) || null,
    source: s.title.match(/⚙️\s*(\S+)/)?.[1] ?? null,
    magnet: magnet(s.infoHash, filename, s.sources),
  }
}
