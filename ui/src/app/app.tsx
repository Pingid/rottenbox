import { createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'

import type { ListItem, Media, SiteAdapter } from '../sites'

import { Panel, DownloadIcon } from '../components'
import { Config, Theme } from '../context'

import { adoptSheet } from './root'

/** Keep keystrokes in our inputs from triggering host-page shortcuts. */
const stop = (e: Event) => e.stopPropagation()

/** Run `fn` (at most once a frame) whenever the page's DOM changes, `<head>` included. */
const onDomChange = (fn: () => void) => {
  let queued = false
  const observer = new MutationObserver(() => {
    if (!queued) ((queued = true), requestAnimationFrame(() => ((queued = false), fn())))
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  onCleanup(() => observer.disconnect())
}

const mediaKey = (m: Media | null) => (m ? [m.type, m.title, m.year, m.season, m.episode].join('|') : '')

/**
 * The media the panel shows: the page's own, kept current across client-side
 * navigation (whose markup updates after the url does), until a list entry is
 * picked; picking holds until the url changes again.
 */
const usePageMedia = (site: SiteAdapter) => {
  const [media, setMedia] = createSignal(site.getMedia(document))
  let picked = false
  let href = location.href

  onDomChange(() => {
    if (location.href !== href) ((href = location.href), (picked = false))
    if (picked) return
    const next = site.getMedia(document)
    if (mediaKey(next) !== mediaKey(media())) setMedia(next)
  })

  const pick = (m: Media) => ((picked = true), setMedia(m))
  return [media, pick] as const
}

/** Decorate list entries now and whenever the page adds more. */
const useListItems = (site: SiteAdapter) => {
  const [items, setItems] = createSignal<ListItem[]>([])
  if (!site.listItems) return items

  const scan = () => {
    const added = site.listItems!(document)
    const alive = items().filter((i) => i.el.isConnected)
    if (added.length || alive.length !== items().length) setItems([...alive, ...added])
  }
  scan()
  onDomChange(scan)
  onCleanup(() => {
    // take our mounts out of the page, so a fresh App (HMR, re-enable) decorates the same entries again
    for (const item of items()) item.el.remove()
  })
  return items
}

export const App = (p: { site: SiteAdapter; sheet: CSSStyleSheet }) => {
  const { config, setConfig } = Config.use()
  const theme = Theme.use()
  const [media, pickMedia] = usePageMedia(p.site)
  const items = useListItems(p.site)

  const open = (m: Media) => {
    pickMedia(m)
    setConfig('open', true)
  }

  return (
    <div
      class="theme font-sans text-xs text-fg antialiased"
      classList={{ dark: theme.resolved() === 'dark' }}
      on:keydown={stop}
      on:keyup={stop}
      on:keypress={stop}
    >
      <Show when={media()}>
        {(m) => (
          <Show
            when={config.open}
            fallback={
              <button
                type="button"
                title={`Torrents · ${m().title}`}
                onClick={() => setConfig('open', true)}
                class="fixed right-4 bottom-4 grid size-9 place-items-center rounded-full bg-surface text-muted shadow-lg ring-1 ring-line hover:text-fg"
              >
                <DownloadIcon />
              </button>
            }
          >
            {/* keyed: remount (and refetch) when another item is picked */}
            <Show when={m()} keyed>
              {(media) => <Panel media={media} />}
            </Show>
          </Show>
        )}
      </Show>

      <For each={items()}>
        {(item) => (
          <Portal mount={item.el} useShadow ref={(el: HTMLDivElement) => adoptSheet(el.shadowRoot, p.sheet)}>
            <button
              type="button"
              title={`Torrents · ${item.media.title}`}
              // a direct listener, not solid's document-level delegation: posters often sit inside
              // links whose own (router) click handlers would otherwise run first
              on:click={(e) => {
                e.preventDefault()
                e.stopPropagation()
                open(item.media)
              }}
              class={`${item.compact ? 'size-5' : 'size-7'} grid cursor-pointer place-items-center rounded-full bg-zinc-900/85 text-zinc-200 shadow ring-1 ring-white/15 backdrop-blur hover:bg-zinc-900 hover:text-white`}
              classList={{
                'ring-sky-400 text-sky-300': media() === item.media && config.open,
              }}
            >
              <DownloadIcon />
            </button>
          </Portal>
        )}
      </For>
    </div>
  )
}
