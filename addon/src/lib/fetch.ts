import * as Req from '@rottenbox/ui/lib/util/req'

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

/** Runs the content script's requests from here, where host permissions lift CORS. Timeouts live in `fromFetch`. */
export const background = () => {
  const fetcher = Req.fromFetch()

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FETCH') {
      fetcher(message.kind, message.input, message.init).then(sendResponse)
      return true // Crucial: signals async response to Chrome
    }
  })
}
