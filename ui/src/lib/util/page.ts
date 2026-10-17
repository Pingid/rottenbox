const attr = (doc: Document, selector: string, name: string) => doc.querySelector(selector)?.getAttribute(name)

const toUrl = (u: string | null | undefined) => {
  try {
    return u ? [new URL(u, location.href)] : []
  } catch {
    return []
  }
}

/**
 * Urls that may name the original site: the location, then canonical / og:url,
 * which proxies and mirrors usually leave pointing at the real host.
 */
export const urls = (doc: Document): URL[] => [
  ...toUrl(location.href),
  ...toUrl(attr(doc, 'link[rel="canonical"]', 'href')),
  ...toUrl(attr(doc, 'meta[property="og:url"]', 'content')),
]

/** Site names the page declares about itself, lowercased, `@` handles stripped. */
export const names = (doc: Document): string[] =>
  [
    attr(doc, 'meta[property="og:site_name"]', 'content'),
    attr(doc, 'meta[name="application-name"]', 'content'),
    attr(doc, 'meta[name="apple-mobile-web-app-title"]', 'content'),
    attr(doc, 'meta[name="twitter:site"]', 'content'),
  ].flatMap((n) => (n ? [n.trim().toLowerCase().replace(/^@/, '')] : []))
