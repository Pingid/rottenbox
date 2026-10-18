/**
 * Host access for user-added sources. Only Cinemeta is granted at install;
 * any other host is an optional permission, asked for the first time a
 * source needs it.
 */

/** `https://host[:port]` of a url, or null for anything that isn't http(s). */
export const origin = (url: string) => {
  try {
    const u = new URL(url)
    return /^https?:$/.test(u.protocol) ? u.origin : null
  } catch {
    return null
  }
}

const pattern = (origin: string) => `${origin}/*`

export const has = (origin: string) => chrome.permissions.contains({ origins: [pattern(origin)] })

/** The prompt page; `permissions.request` needs a click on an extension page, not in a content script. */
export const PAGE = 'src/grant/grant.html'

/**
 * Open the prompt page for `origin` and resolve once access is granted, or
 * with false when the prompt is closed without granting.
 */
export const request = async (origin: string): Promise<boolean> => {
  if (await has(origin)) return true
  const url = chrome.runtime.getURL(`${PAGE}?origin=${encodeURIComponent(origin)}`)
  const win = await chrome.windows.create({ url, type: 'popup', width: 420, height: 260, focused: true })
  return new Promise((resolve) => {
    const done = (granted: boolean) => {
      chrome.permissions.onAdded.removeListener(added)
      chrome.windows.onRemoved.removeListener(removed)
      resolve(granted)
    }
    const added = async () => {
      if (await has(origin)) done(true)
    }
    const removed = async (id: number) => {
      if (id === win?.id) done(await has(origin))
    }
    chrome.permissions.onAdded.addListener(added)
    chrome.windows.onRemoved.addListener(removed)
  })
}
