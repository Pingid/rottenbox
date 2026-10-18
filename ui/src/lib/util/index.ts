export * as Clipboard from './clipboard'
export * as Drag from './drag'
export * as Page from './page'
export * as Time from './time'
export * as Req from './req'

/** All ld+json payloads on the page, flattened (arrays and @graph). */
const readLdJson = (d: Document): unknown[] =>
  [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap((el) => {
    try {
      // some sites wrap the json in `/* <![CDATA[ */ ... /* ]]> */`
      const text = (el.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
      const json = JSON.parse(text)
      const list = Array.isArray(json) ? json : [json]
      return list.flatMap((x) => x?.['@graph'] ?? [x])
    } catch {
      return []
    }
  })

export const LdJson = { read: readLdJson }
