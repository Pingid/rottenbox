import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js'

import { Clipboard, Manifest, Req, Stremio } from '../lib'
import type { Media } from '../sites'

import { EpisodePicker } from './episodes'
import { MatchPicker } from './overview'
import { CheckIcon, CopyIcon, IconButton, Failure, Message } from './ui'
import { Config, Query, Fetch, type Resolve } from '../context'

export const Streams = (p: { media: Media; resolved: Resolve.Resolved }) => {
  const { config, setConfig } = Config.use()
  const r = Fetch.use()
  const res = p.resolved

  const providers = () =>
    config.sources.filter((x): x is Manifest.StremioSource => x.kind === 'stremio' && x.enabled && !!x.url.trim())
  // skip addons whose manifest says they don't serve this type / id; if the manifest
  // can't be read, ask for streams anyway and let that request report the problem
  const manifests = Query.useAll(() => ({
    queries: providers().map((x) => Stremio.queries.manifest(r, x.url)),
  }))
  const serves = (i: number) => {
    const m = manifests[i]
    if (m?.data) return Stremio.serves(m.data, 'stream', p.media.type, res.videoId() ?? '')
    return !!m?.isError
  }
  const results = Query.useAll(() => ({
    queries: providers().map((x, i) => ({
      ...Stremio.queries.streams(r, x.url, p.media.type, res.videoId() ?? ''),
      enabled: !!res.videoId() && serves(i),
    })),
  }))
  const active = () => providers().flatMap((x, i) => (serves(i) ? [{ x, q: results[i] }] : []))
  // Rows show as each addon answers; a slow or failing one doesn't hold back the rest.
  const streams = createMemo(() =>
    Stremio.merge(active().map(({ x, q }) => ({ provider: x.label || x.url, streams: q?.data ?? [] }))),
  )
  const pending = () => manifests.some((m) => m.isLoading)
  const streamsError = () => active().length > 0 && active().every(({ q }) => q?.isError)
  const streamsLoading = () => streams().length === 0 && (pending() || active().some(({ q }) => q?.isLoading))

  // Retry feedback: which query is backing off, and which failed for good.
  const named = () => [
    ...res.queries(),
    ...active().map(({ x, q }) => ({ name: x.label || Stremio.baseUrl(x.url), q, fallback: false })),
  ]
  const retrying = () => named().find((x) => x.q?.isFetching && x.q.failureCount > 0)
  const failed = () => named().filter((x) => !x.fallback && x.q?.isError)
  const retryFailed = () => failed().forEach((x) => x.q.refetch())

  /** Template values for a stream row's actions. */
  const vars = (s: Stremio.ParsedStream): Config.Vars => ({
    ...res.vars(),
    magnet: s.magnet,
    hash: s.hash,
    name: s.filename,
    fileIdx: s.fileIdx?.toString(),
    url: s.url,
  })

  const groups = createMemo(() => [...new Set(streams().map((s) => s.group))])
  // The saved choice is kept even when this title has no such group.
  const group = () => (groups().includes(config.quality) ? config.quality : 'all')
  const visible = () => streams().filter((s) => group() === 'all' || s.group === group())

  return (
    <div class="flex min-h-0 flex-col">
      <Show when={res.metas().length > 1}>
        <div class="border-b border-line px-3 py-2">
          <MatchPicker resolved={res} />
        </div>
      </Show>

      <Show when={res.isSeries() && res.video()}>
        {(v) => (
          <EpisodePicker
            videos={res.videos()}
            current={v()}
            onPick={(x) => res.setPick({ season: x.season, episode: x.episode })}
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
          <Message>No stream sources enabled. Add a Stremio addon in settings.</Message>
        </Match>
        <Match when={res.error() || streamsError()}>
          <Message>
            Couldn't load streams.
            <For each={failed()}>
              {(x) => (
                <span class="mt-1 block text-subtle">
                  <Failure name={x.name} query={x.q} />
                </span>
              )}
            </For>
            <button type="button" onClick={retryFailed} class="mt-2 rounded px-2 py-0.5 text-accent hover:bg-hover">
              Try again
            </button>
          </Message>
        </Match>
        <Match when={res.loading() || streamsLoading()}>
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
        <Match when={!res.meta()}>
          <Message>No match found.</Message>
        </Match>
        <Match when={res.isSeries() && !res.video()}>
          <Message>No episodes found.</Message>
        </Match>
        <Match when={active().length === 0}>
          <Message>None of the enabled addons serve this title.</Message>
        </Match>
        <Match when={visible().length === 0}>
          <Message>No streams found.</Message>
        </Match>
        <Match when={true}>
          {/* some providers answered; say which didn't rather than silently showing fewer rows */}
          <Show when={retrying() ?? failed()[0]}>
            {(x) => (
              <div class="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1 text-subtle">
                <span class="min-w-0 flex-1 truncate">
                  <Failure name={x().name} query={x().q} />
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
                        {/* actions needing a value this stream lacks (`{magnet}` on an http stream) are left out */}
                        <For each={config.actions.filter((a) => !Config.missing(a.url, vars(s)))}>
                          {(a) => <ActionButton action={a} vars={() => vars(s)} />}
                        </For>
                      </div>
                    </div>
                    <span class="-my-1 shrink-0">
                      <CopyLink text={s.magnet ?? s.url ?? ''} what={s.magnet ? 'magnet link' : 'link'} />
                    </span>
                  </div>
                  <div class="mt-0.5 truncate text-muted" title={s.filename}>
                    {s.filename}
                    <Show when={s.source}> · {s.source}</Show>
                    <Show when={s.kind !== 'torrent'}> · {s.kind}</Show>
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

/** Copies the stream's magnet uri or url, showing a check for a moment after. */
const CopyLink = (p: { text: string; what: string }) => {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const copy = async () => {
    if (!(await Clipboard.copy(p.text))) return
    setCopied(true)
    clearTimeout(timer)
    timer = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <IconButton title={copied() ? 'Copied' : `Copy ${p.what}`} active={copied()} onClick={copy}>
      <Show when={copied()} fallback={<CopyIcon />}>
        <CheckIcon />
      </Show>
    </IconButton>
  )
}

const TONE = { idle: 'text-accent', pending: 'text-accent', ok: 'text-ok', error: 'text-danger' }
const ICON = { idle: '', pending: '… ', ok: '✓ ', error: '✕ ' }

const actionClass = 'rounded px-1.5 hover:bg-accent-soft disabled:opacity-50'

/** One configured action on a stream row: a link to open, or a request to send. */
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
