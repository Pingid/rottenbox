import * as Req from '@rottenbox/ui/lib/util/req'

import * as Access from './access'

export const content = (): Req.Requester => (kind, input, init) => {
  // Normalize Headers instance if passed, and omit non-serializable fields (like signal)
  const headers = init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers

  return chrome.runtime.sendMessage({
    type: 'FETCH',
    kind,
    input,
    init: {
      method: init?.method,
      body: init?.body,
      headers,
    },
  })
}

/** Ask the background to get host access to `origin`; resolves once the user has answered. */
export const grant = (origin: string): Promise<boolean> => chrome.runtime.sendMessage({ type: 'GRANT', origin })

/**
 * Runs the content script's requests from here, where host permissions lift
 * CORS. Hosts without permission fail fast with `grant` set, so the panel can
 * offer to ask for it. Timeouts live in `fromFetch`.
 */
export const background = () => {
  const fetcher = Req.fromFetch()

  const run = async (message: any): Promise<Req.FetchResult<unknown>> => {
    const origin = Access.origin(message.input)
    if (origin && !(await Access.has(origin)))
      return { ok: false, grant: origin, error: `no access to ${origin}`, status: 0 }
    return fetcher(message.kind, message.input, message.init)
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FETCH') {
      run(message).then(sendResponse)
      return true // Crucial: signals async response to Chrome
    }
    if (message?.type === 'GRANT' && typeof message.origin === 'string') {
      Access.request(message.origin).then(sendResponse)
      return true
    }
  })
}
