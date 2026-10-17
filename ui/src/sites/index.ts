import { Page } from '../lib'

import { rottenTomatoes } from './rottentomatoes'
import { letterboxd } from './letterboxd'
import { metacritic } from './metacritic'

import { devSite } from './dev'

import type { SiteAdapter } from './types'
export * from './types'

const adapters: SiteAdapter[] = [rottenTomatoes, letterboxd, metacritic]

/** Only tried after every real site has failed both checks. */
const fallbacks: SiteAdapter[] = import.meta.env.DEV ? [devSite] : []

/**
 * Pick the adapter for this page, strongest signal first: any url naming the
 * site, then markup fingerprints, so proxied / mirrored copies still work.
 */
export const detectSite = (doc = document) => {
  const urls = Page.urls(doc)
  return (
    adapters.find((a) => urls.some(a.match)) ??
    adapters.find((a) => a.fingerprint?.(doc)) ??
    fallbacks.find((a) => urls.some(a.match)) ??
    null
  )
}
