import { createMemo, Show } from 'solid-js'
import { render } from 'solid-js/web'

import { createRoot, createSheet } from './root'
import { App } from './app'

import { Config, Query, Persist, Theme, Fetch } from '../context'
import { detectSite } from '../sites'

import twstyles from '../index.css?inline'

export const UI = (p: { styles: CSSStyleSheet; storage: Persist.AsyncStorage; fetcher: Fetch.Requester }) => {
  const site = createMemo(() => detectSite())

  return (
    <Show when={site()}>
      {(site) => (
        <Fetch.Provider value={p.fetcher}>
          <Persist.Provider value={p.storage}>
            <Query.Provider client={Query.client}>
              <Theme.Provider>
                <Config.Provider>
                  <App site={site()} sheet={p.styles} />
                </Config.Provider>
              </Theme.Provider>
            </Query.Provider>
          </Persist.Provider>
        </Fetch.Provider>
      )}
    </Show>
  )
}

/** Mount the UI on supported pages; returns a function that removes it again. */
export const renderInline = (opts?: { storage?: Persist.AsyncStorage; styles?: string; fetcher?: Fetch.Requester }) => {
  const { storage = Persist.idb('storage'), styles = twstyles, fetcher = Fetch.fromFetch() } = opts ?? {}

  // leave unsupported pages untouched: no root element, no hoisted styles
  if (!detectSite()) return () => {}

  const sheet = createSheet(styles)

  const root = createRoot({
    id: 'rottenbox',
    sheet,
    style: { position: 'fixed', top: '0', left: '0', zIndex: '2147483647' },
  })

  let disposed = false
  let dispose = () => {}
  const restored = Query.persistant(storage)
  restored.then(() => {
    if (!disposed) dispose = render(() => <UI storage={storage} styles={sheet} fetcher={fetcher} />, root.shadow)
  })

  return () => {
    disposed = true
    dispose()
    root.destroy()
  }
}
