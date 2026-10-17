import { createSignal, Show } from 'solid-js'

import { Config } from '../context'
import type { Media } from '../sites'
import { Drag } from '../lib'

import { CloseIcon, GearIcon, IconButton } from './ui'
import { Torrents } from './torrents'
import { Settings } from './settings'

export const Panel = (p: { media: Media }) => {
  const { config, setConfig } = Config.use()
  const [settings, setSettings] = createSignal(false)
  const vp = Drag.useViewport()
  const [draft, setDraft] = createSignal<Drag.Rect>()

  const rect = () =>
    Drag.clampRect(draft() ?? config.rect ?? Drag.defaultRect(vp()), { vp: vp(), min: { w: 80, h: 260 }, gap: 8 })

  const drag = (mode: Drag.DragMode) => (e: PointerEvent) => {
    // let header buttons receive their own clicks
    if (mode === 'move' && (e.target as Element).closest('button')) return
    Drag.startDrag(e, {
      mode,
      rect: rect(),
      vp: vp(),
      min: { w: 80, h: 260 },
      gap: 8,
      onDraft: setDraft,
      onCommit: (r) => (setConfig('rect', r), setDraft(undefined)),
    })
  }

  return (
    <div
      class="fixed flex flex-col overflow-hidden rounded-lg bg-surface text-fg shadow-2xl ring-1 ring-line"
      style={{
        left: `${rect().x}px`,
        top: `${rect().y}px`,
        width: `${rect().w}px`,
        height: `${rect().h}px`,
      }}
    >
      <header
        class="flex shrink-0 cursor-move items-center gap-1 border-b border-line py-1.5 pr-1.5 pl-3 select-none"
        title="Drag to move · double-click to reset"
        onPointerDown={drag('move')}
        onDblClick={() => setConfig('rect', undefined)}
      >
        <div class="min-w-0 flex-1 truncate text-sm font-medium">
          {p.media.title}
          <Show when={p.media.year}>
            <span class="ml-1.5 font-normal text-muted">{p.media.year}</span>
          </Show>
        </div>
        <IconButton title="Settings" active={settings()} onClick={() => setSettings((v) => !v)}>
          <GearIcon />
        </IconButton>
        <IconButton title="Close" onClick={() => setConfig('open', false)}>
          <CloseIcon />
        </IconButton>
      </header>

      <Show when={settings()}>
        <Settings />
      </Show>
      {/* hidden rather than unmounted so results survive opening settings */}
      <div class={settings() ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <Torrents media={p.media} />
      </div>

      <Grip corner="bl" onPointerDown={drag('resize-bl')} />
      <Grip corner="br" onPointerDown={drag('resize-br')} />
    </div>
  )
}

const Grip = (p: { corner: 'bl' | 'br'; onPointerDown: (e: PointerEvent) => void }) => (
  <div
    class="absolute bottom-0 size-3 text-subtle hover:text-muted"
    classList={{
      'left-0 cursor-nesw-resize -scale-x-100': p.corner === 'bl',
      'right-0 cursor-nwse-resize': p.corner === 'br',
    }}
    title="Drag to resize"
    onPointerDown={p.onPointerDown}
  >
    <svg viewBox="0 0 12 12" class="size-3" stroke="currentColor" stroke-width="1.25">
      <path d="M11 5 5 11M11 8.5 8.5 11" />
    </svg>
  </div>
)
