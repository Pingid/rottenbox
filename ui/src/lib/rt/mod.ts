import { LdJson } from '../util'

import type { MediaPageItem, SchemaOrgPayload } from './types'

export * from './types'

const PAGE_TYPES = ['Movie', 'TVSeries', 'TVSeason', 'TVEpisode']

const isMedia = (x: unknown): x is MediaPageItem =>
  !!x && typeof x === 'object' && PAGE_TYPES.includes((x as { '@type'?: string })['@type'] ?? '')

/** All ld+json payloads on the page, flattened (arrays and @graph). */
export const getData = (d: Document) => LdJson.read(d) as SchemaOrgPayload[]

/** The movie / series / season / episode the page is about, if any. */
export const getMediaItem = (d: Document) => (getData(d).find(isMedia) as MediaPageItem | undefined) ?? null
