import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js'

import { Clipboard, IMDB, Req, Stremio } from '../lib'
import type { Media } from '../sites'

import { EpisodePicker, sortVideos } from './episodes'
import { CheckIcon, CopyIcon, IconButton, inputClass, Message } from './ui'
import { Config, Query, Fetch } from '../context'

export const Torrents = (p: { media: Media }) => {
  const { config, setConfig } = Config.use()
  const r = Fetch.use()

  // Resolve the title to a Cinemeta entry: by IMDb id when the site gives one,
  // else (or if the id is unknown) by title search.
  const byId = Query.use(() => ({
    ...IMDB.queries.meta(r, p.media.type, p.media.imdb ?? ''),
    enabled: !!p.media.imdb,
  }))
  const search = Query.use(() => ({
    ...IMDB.queries.search(r, { query: p.media.title, year: p.media.year, type: p.media.type }),
    enabled: !p.media.imdb || byId.isError,
  }))
  const metas = () => (byId.data ? [byId.data] : (search.data ?? []))

  const [metaId, setMetaId] = createSignal<string>()
  const meta = () => {
    const list = metas()
    return list.find((m) => m.id === metaId()) ?? IMDB.pickBest(list, p.media.year)
  }

  // series: load the episode list and track which one is picked
  const isSeries = () => p.media.type === 'series'
  const details = Query.use(() => ({
    ...IMDB.queries.meta(r, 'series', meta()?.id ?? ''),
    enabled: isSeries() && !!meta(),
  }))
  const videos = createMemo(() => sortVideos(details.data?.videos))
  const [pick, setPick] = createSignal({
    season: p.media.season ?? 1,
    episode: p.media.episode,
  })
  /** Picked episode, falling back to the season's first, then the show's first. */
  const video = createMemo(() => {
    const { season, episode } = pick()
    const v = videos()
    return (
      v.find((x) => x.season === season && x.episode === episode) ??
      v.find((x) => x.season === season) ??
      v.find((x) => x.season > 0) ??
      v[0]
    )
  })

  const streamId = () => (isSeries() ? video()?.id : meta()?.id)
  const providers = () => config.providers.filter((x) => x.enabled && x.url.trim())
  const results = Query.useAll(() => ({
    queries: providers().map((x) => ({
      ...Stremio.queries.streams(r, x.url, p.media.type, streamId() ?? ''),
      enabled: !!streamId(),
    })),
  }))
  // Rows show as each addon answers; a slow or failing one doesn't hold back the rest.
  const streams = createMemo(() =>
    Stremio.merge(providers().map((x, i) => ({ provider: x.label || x.url, streams: results[i]?.data ?? [] }))),
  )
  const streamsError = () => results.length > 0 && results.every((r) => r.isError)
  const streamsLoading = () => streams().length === 0 && results.some((r) => r.isLoading)

  // Retry feedback: which query is backing off, and which failed for good.
  const named = () => [
    { name: 'Cinemeta', q: byId },
    { name: 'Cinemeta', q: search },
    { name: 'Cinemeta', q: details },
    ...providers().map((x, i) => ({ name: x.label || Stremio.baseUrl(x.url), q: results[i] })),
  ]
  const retrying = () => named().find((x) => x.q?.isFetching && x.q.failureCount > 0)
  // a failed id lookup falls back to search, so only search's own failure counts
  const failed = () => named().filter((x) => x.q !== byId && x.q?.isError)
  const retryFailed = () => failed().forEach((x) => x.q.refetch())

  /** Template values for a torrent row's actions. */
  const vars = (s: Stremio.ParsedStream): Config.Vars => ({
    magnet: s.magnet,
    hash: s.hash,
    name: s.filename,
    title: p.media.title,
    year: p.media.year,
    type: p.media.type,
    imdb: meta()?.id,
    id: streamId(),
    season: video()?.season.toString(),
    episode: video()?.episode.toString(),
    fileIdx: s.fileIdx?.toString(),
  })

  const groups = createMemo(() => [...new Set(streams().map((s) => s.group))])
  // The saved choice is kept even when this title has no such group.
  const group = () => (groups().includes(config.quality) ? config.quality : 'all')
  const visible = () => streams().filter((s) => group() === 'all' || s.group === group())

  return (
    <div class="flex min-h-0 flex-col">
      <Show when={metas().length > 1}>
        <div class="border-b border-line px-3 py-2">
          <select class={inputClass} value={meta()?.id} onChange={(e) => setMetaId(e.currentTarget.value)}>
            <For each={metas()}>
              {(m) => (
                <option value={m.id}>
                  {m.name} ({m.releaseInfo ?? m.year ?? '?'})
                </option>
              )}
            </For>
          </select>
        </div>
      </Show>

      <Show when={isSeries() && video()}>
        {(v) => (
          <EpisodePicker
            videos={videos()}
            current={v()}
            onPick={(x) => setPick({ season: x.season, episode: x.episode })}
          />
        )}
      </Show>

      <Show when={groups().length > 1}>
        <div class="flex gap-1 border-b border-line overflow-x-auto scrollbar-none shrink-0 grow-0 py-1 px-2">
          <For each={['all', ...groups()]}>
            {(g) => (
              <button
                type="button"
                onClick={() => setConfig('quality', g)}
                class="rounded px-1.5 py-0.5 text-muted hover:text-fg"
                classList={{ 'bg-hover text-fg': group() === g }}
              >
                {g}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Switch>
        <Match when={providers().length === 0}>
          <Message>No torrent providers enabled. Add one in settings.</Message>
        </Match>
        <Match when={search.isError || details.isError || streamsError()}>
          <Message>
            Couldn't load torrents.
            <For each={failed()}>
              {(x) => (
                <span class="mt-1 block text-subtle">
                  {x.name}: {Req.describe(x.q.error)}
                </span>
              )}
            </For>
            <button type="button" onClick={retryFailed} class="mt-2 rounded px-2 py-0.5 text-accent hover:bg-hover">
              Try again
            </button>
          </Message>
        </Match>
        <Match when={byId.isLoading || search.isLoading || details.isLoading || streamsLoading()}>
          <Message>
            Searching…
            <Show when={retrying()}>
              {(x) => (
                <span class="mt-1 block text-subtle">
                  {x().name}: {Req.describe(x().q.failureReason)}, retrying ({x().q.failureCount}/{Req.RETRIES})
                </span>
              )}
            </Show>
          </Message>
        </Match>
        <Match when={!meta()}>
          <Message>No match found.</Message>
        </Match>
        <Match when={isSeries() && !video()}>
          <Message>No episodes found.</Message>
        </Match>
        <Match when={visible().length === 0}>
          <Message>No torrents found.</Message>
        </Match>
        <Match when={true}>
          {/* some providers answered; say which didn't rather than silently showing fewer rows */}
          <Show when={retrying() ?? failed()[0]}>
            {(x) => (
              <div class="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1 text-subtle">
                <span class="min-w-0 flex-1 truncate">
                  {x().name}: {Req.describe(x().q.failureReason)}
                  {x().q.isFetching ? `, retrying (${x().q.failureCount}/${Req.RETRIES})` : ''}
                </span>
                <Show when={!x().q.isFetching}>
                  <button type="button" onClick={retryFailed} class="rounded px-1.5 text-accent hover:bg-hover">
                    Retry
                  </button>
                </Show>
              </div>
            )}
          </Show>
          <ul class="min-h-0 divide-y divide-line overflow-y-auto">
            <For each={visible()}>
              {(s) => (
                <li class="px-3 py-2 hover:bg-hover @container">
                  <div class="grid grid-cols-[1fr_1rem] w-full">
                    <div class="grid @min-2xs:grid-cols-[1fr_auto] gap-2 tabular-nums">
                      {/* stats keep their width; the button group wraps instead */}
                      <div class="flex flex-1 items-center gap-2 whitespace-nowrap">
                        <span class="rounded bg-hover px-1.5 font-medium">{s.quality}</span>
                        <span class="text-muted">{s.size}</span>
                        <Show when={s.seeders}>
                          <span class="text-muted">↑{s.seeders}</span>
                        </Show>
                      </div>
                      <div class="flex items-center shrink-0">
                        <For each={config.actions}>{(a) => <ActionButton action={a} vars={() => vars(s)} />}</For>
                      </div>
                    </div>
                    <span class="-my-1 shrink-0">
                      <CopyMagnet magnet={s.magnet} />
                    </span>
                  </div>
                  <div class="mt-0.5 truncate text-muted" title={s.filename}>
                    {s.filename}
                    <Show when={s.source}> · {s.source}</Show>
                    <Show when={providers().length > 1}> · {s.provider}</Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Match>
      </Switch>
    </div>
  )
}

/** Copies the magnet uri, showing a check for a moment after. */
const CopyMagnet = (p: { magnet: string }) => {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const copy = async () => {
    if (!(await Clipboard.copy(p.magnet))) return
    setCopied(true)
    clearTimeout(timer)
    timer = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <IconButton title={copied() ? 'Copied' : 'Copy magnet link'} active={copied()} onClick={copy}>
      <Show when={copied()} fallback={<CopyIcon />}>
        <CheckIcon />
      </Show>
    </IconButton>
  )
}

const TONE = { idle: 'text-accent', pending: 'text-accent', ok: 'text-ok', error: 'text-danger' }
const ICON = { idle: '', pending: '… ', ok: '✓ ', error: '✕ ' }

const actionClass = 'rounded px-1.5 hover:bg-accent-soft disabled:opacity-50'

/** One configured action on a torrent row: a link to open, or a request to send. */
const ActionButton = (p: { action: Config.Action; vars: () => Config.Vars }) => (
  <Show when={!Config.isLink(p.action)} fallback={<LinkAction action={p.action} vars={p.vars} />}>
    <RequestAction action={p.action} vars={p.vars} />
  </Show>
)

const LinkAction = (p: { action: Config.Action; vars: () => Config.Vars }) => {
  const href = () => Config.fillTemplate(p.action.url, p.vars())
  const external = () => /^https?:/i.test(href())
  return (
    <a href={href()} target={external() ? '_blank' : undefined} rel="noreferrer" class={`${actionClass} text-accent`}>
      {p.action.label || 'Link'}
    </a>
  )
}

/** Sends the request; shows pending, then ✓ or the error for a moment. */
const RequestAction = (p: { action: Config.Action; vars: () => Config.Vars }) => {
  const [state, setState] = createSignal<{ status: 'idle' | 'pending' | 'ok' | 'error'; message?: string }>({
    status: 'idle',
  })
  const r = Fetch.use()
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  const settle = (next: ReturnType<typeof state>, ms: number) => {
    setState(next)
    clearTimeout(timer)
    timer = setTimeout(() => setState({ status: 'idle' }), ms)
  }

  const run = async () => {
    if (state().status === 'pending') return
    setState({ status: 'pending' })
    try {
      await r.send(Config.buildRequest(p.action, p.vars()))
      settle({ status: 'ok' }, 1500)
    } catch (e) {
      settle({ status: 'error', message: e instanceof Error ? e.message : String(e) }, 4000)
    }
  }

  const title = () => {
    const s = state()
    if (s.status === 'error') return s.message
    if (s.status === 'ok') return 'Sent'
    return `${p.action.method} ${p.action.url}`
  }

  return (
    <button
      type="button"
      title={title()}
      disabled={state().status === 'pending'}
      onClick={run}
      // one colour class per state: stacked text-* utilities would fight over order
      class={`${actionClass} ${TONE[state().status]}`}
    >
      {ICON[state().status]}
      {p.action.label || 'Action'}
    </button>
  )
}
