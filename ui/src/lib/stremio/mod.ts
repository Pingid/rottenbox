import { queryOptions } from '@tanstack/solid-query'

import { Req, Time } from '../util'

import type { AddonManifest, Stream, StreamResponse } from './types'

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
export const query = (r: Req.Client, addon: string, type: 'movie' | 'series', id: string) =>
  r.json<StreamResponse>(`${baseUrl(addon)}/stream/${type}/${id}.json`)

export const manifest = (r: Req.Client, addon: string) => r.json<AddonManifest>(`${baseUrl(addon)}/manifest.json`)

export const isManifest = (x: any): x is AddonManifest =>
  !!x && typeof x === 'object' && typeof x.id === 'string' && Array.isArray(x.resources) && Array.isArray(x.types)

/** Whether the addon offers `resource`, optionally for this content type and id. */
export const serves = (m: AddonManifest, resource: string, type?: string, id?: string) =>
  m.resources.some((res) => {
    const r = typeof res === 'string' ? { name: res } : res
    if (r.name !== resource) return false
    // a resource's own types / prefixes override the manifest-wide ones
    const types = r.types ?? m.types
    const prefixes = r.idPrefixes ?? m.idPrefixes
    if (type && !types.includes(type)) return false
    if (id && prefixes?.length && !prefixes.some((p) => id.startsWith(p))) return false
    return true
  })

export const queries = {
  /** An addon's manifest; rarely changes, so recheck daily. */
  manifest: (r: Req.Client, addon: string) =>
    queryOptions({
      queryKey: ['stremio', baseUrl(addon), 'manifest'] as const,
      queryFn: () => manifest(r, addon),
      staleTime: Time.day,
      gcTime: 7 * Time.day,
    }),
  /**
   * Parsed streams from one addon. The raw response is what gets
   * cached (`select` runs per observer), so the persisted cache survives
   * parser changes. Freshness follows the addon's own hint (default 1h).
   */
  streams: (r: Req.Client, addon: string, type: 'movie' | 'series', id: string) =>
    queryOptions({
      queryKey: ['stremio', baseUrl(addon), type, id] as const,
      queryFn: () => query(r, addon, type, id),
      select: (r) => (r.streams ?? []).flatMap((s) => parseStream(s) ?? []),
      staleTime: (q) => (q.state.data?.cacheMaxAge ?? 3600) * Time.second,
      // Torrentio allows stale-if-error for a week: old results beat none.
      gcTime: 7 * Time.day,
    }),
}

/**
 * Combine per-addon results in addon order; the first addon to list a stream
 * (same torrent file, or same url) wins, later duplicates are dropped.
 */
export const merge = (results: { provider: string; streams: ParsedStream[] }[]) => {
  const seen = new Set<string>()
  const out: (ParsedStream & { provider: string })[] = []
  for (const { provider, streams } of results)
    for (const s of streams) {
      const key = s.key
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

export type StreamKind = 'torrent' | 'url' | 'external' | 'youtube'

export type ParsedStream = {
  kind: StreamKind
  /** identity for de-duplication across addons */
  key: string
  filename: string
  /** Display label, e.g. "4k DV | HDR" */
  quality: string
  /** Filter bucket, e.g. "4k", "1080p", "other" */
  group: string
  size: string | null
  seeders: number | null
  source: string | null
  /** torrents only */
  hash?: string
  fileIdx?: number
  /** magnet uri with the stream's trackers; torrents only */
  magnet?: string
  /** where to play / open it: the http url, external page or youtube video */
  url?: string
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
 * Flatten a stream into display fields, whatever its kind. Detail parsing
 * follows torrentio's format (💾 size, 👤 seeders, ⚙️ source), which most
 * addons copy; fields an addon doesn't provide come out null. Streams with
 * nothing to play or open are dropped (null).
 */
export const parseStream = (s: Stream): ParsedStream | null => {
  const title = s.title ?? s.description ?? ''
  const name = s.name ?? ''
  const { quality, size } = parseStreamTitle(title)
  const filename = s.behaviorHints?.filename ?? title.split('\n')[0] ?? name
  const label = name.split('\n')[1]?.trim() || quality || name.split('\n')[0]?.trim() || '?'
  const first = label.split(/\s/)[0].toLowerCase()
  const common = {
    filename: filename || label,
    quality: label,
    group: first === '2160p' ? '4k' : GROUPS.includes(first) ? first : 'other',
    size: size?.raw ?? null,
    seeders: Number(title.match(/👤\s*(\d+)/)?.[1] ?? NaN) || null,
    source: title.match(/⚙️\s*(\S+)/)?.[1] ?? null,
  }
  if (s.infoHash)
    return {
      ...common,
      kind: 'torrent',
      key: `${s.infoHash.toLowerCase()}:${s.fileIdx ?? ''}`,
      hash: s.infoHash,
      fileIdx: s.fileIdx,
      magnet: magnet(s.infoHash, filename, s.sources),
    }
  if (s.url) return { ...common, kind: 'url', key: s.url, url: s.url }
  if (s.externalUrl) return { ...common, kind: 'external', key: s.externalUrl, url: s.externalUrl }
  if (s.ytId) {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(s.ytId)}`
    return { ...common, kind: 'youtube', key: url, url }
  }
  return null
}
