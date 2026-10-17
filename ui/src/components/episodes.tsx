import { createMemo, For } from 'solid-js'

import type { IMDB } from '../lib'

import { ChevronIcon, IconButton, inputClass } from './ui'

/** Specials (season 0) sort last. */
const seasonKey = (s: number) => (s === 0 ? Infinity : s)

export const sortVideos = (videos: IMDB.MetaVideo[] = []) =>
  [...videos].sort((a, b) => seasonKey(a.season) - seasonKey(b.season) || a.episode - b.episode)

const isUpcoming = (v: IMDB.MetaVideo) => !!v.released && new Date(v.released).getTime() > Date.now()

/** Season + episode selects with prev/next, over a sorted video list. */
export const EpisodePicker = (p: {
  videos: IMDB.MetaVideo[]
  current: IMDB.MetaVideo
  onPick: (v: IMDB.MetaVideo) => void
}) => {
  const seasons = createMemo(() => [...new Set(p.videos.map((v) => v.season))])
  const episodes = () => p.videos.filter((v) => v.season === p.current.season)
  const index = () => p.videos.indexOf(p.current)
  const step = (d: number) => {
    const v = p.videos[index() + d]
    if (v) p.onPick(v)
  }

  return (
    <div class="flex items-center gap-1 border-b border-line px-3 py-2">
      <div class="w-20 shrink-0">
        <select
          class={inputClass}
          value={p.current.season}
          onChange={(e) => {
            const s = Number(e.currentTarget.value)
            const first = p.videos.find((v) => v.season === s)
            if (first) p.onPick(first)
          }}
        >
          <For each={seasons()}>{(s) => <option value={s}>{s === 0 ? 'Specials' : `Season ${s}`}</option>}</For>
        </select>
      </div>
      <div class="min-w-0 flex-1">
        <select
          class={inputClass}
          value={p.current.id}
          onChange={(e) => {
            const v = p.videos.find((x) => x.id === e.currentTarget.value)
            if (v) p.onPick(v)
          }}
        >
          <For each={episodes()}>
            {(v) => (
              <option value={v.id}>
                E{v.episode}
                {v.name ? ` · ${v.name}` : ''}
                {isUpcoming(v) ? ` (${v.released!.slice(0, 10)})` : ''}
              </option>
            )}
          </For>
        </select>
      </div>
      <IconButton title="Previous episode" onClick={() => step(-1)}>
        <ChevronIcon dir="left" />
      </IconButton>
      <IconButton title="Next episode" onClick={() => step(1)}>
        <ChevronIcon dir="right" />
      </IconButton>
    </div>
  )
}
