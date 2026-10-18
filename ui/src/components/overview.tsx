import { createMemo, For, Show } from 'solid-js'

import { Manifest, Ratings, type Rating } from '../lib'
import { Config, Fetch, Query, type Resolve } from '../context'

import { Failure, Message } from './ui'

/** Ratings compared on one 0–100 scale, then each links source as a row of chips. */
export const Overview = (p: { resolved: Resolve.Resolved; pageRatings: Rating[] }) => {
  const { config } = Config.use()
  const r = Fetch.use()
  const vars = () => p.resolved.vars()

  const http = () => config.sources.filter((s): s is Manifest.HttpSource => s.kind === 'http' && s.enabled)
  const httpResults = Query.useAll(() => ({
    queries: http().map((s) => {
      const url = Config.fillTemplate(s.url, vars())
      const headers = Config.parseHeaders(s.headers, vars())
      return {
        queryKey: ['http', url, headers] as const,
        queryFn: () => r.json<unknown>(url, { headers }),
        staleTime: Query.HTTP_STALE,
        // `{imdb}` and friends aren't known until the title is matched
        enabled: !!s.url.trim() && !Config.missing(s.url, vars()),
      }
    }),
  }))
  const mapped = createMemo(() =>
    http().map((s, i) => {
      const data = httpResults[i]?.data
      return data === undefined ? { ratings: [], links: [] } : Manifest.mapHttp(s, data)
    }),
  )

  const imdb = (): Rating | null => {
    const m = p.resolved.detail()
    return m
      ? Ratings.from({
          id: 'imdb',
          label: 'IMDb',
          value: m.imdbRating,
          max: 10,
          url: `https://www.imdb.com/title/${m.id}/`,
        })
      : null
  }
  const ratings = () => Ratings.dedupe([...p.pageRatings, imdb(), ...mapped().flatMap((x) => x.ratings)])
  const average = () => {
    const rs = ratings()
    return rs.length > 1 ? Math.round(rs.reduce((a, x) => a + Ratings.percent(x), 0) / rs.length) : null
  }

  /** links sources and link-producing http sources, in settings order */
  const groups = () =>
    config.sources.flatMap((s) => {
      if (!s.enabled) return []
      if (s.kind === 'links') {
        const links = s.links
          .filter((l) => l.url.trim() && !isHere(l.url))
          .map((l) => ({
            label: l.label || hostOf(l.url),
            url: Config.fillTemplate(l.url, vars()),
            disabled: Config.missing(l.url, vars()),
          }))
        return links.length ? [{ id: s.id, label: s.label, links }] : []
      }
      if (s.kind === 'http' && s.produces === 'links') {
        const links = mapped()[http().indexOf(s)]?.links ?? []
        return links.length ? [{ id: s.id, label: s.label, links: links.map((l) => ({ ...l, disabled: false })) }] : []
      }
      return []
    })

  const failed = () =>
    [
      ...p.resolved.queries().filter((x) => !x.fallback),
      ...http().map((s, i) => ({ name: s.label || hostOf(s.url), q: httpResults[i] })),
    ].filter((x) => x.q?.isError)

  return (
    <div class="min-h-0 flex-1 overflow-y-auto">
      <section class="space-y-1.5 px-3 py-3">
        <Show
          when={ratings().length}
          fallback={<Message>{p.resolved.loading() ? 'Looking up ratings…' : 'No ratings found.'}</Message>}
        >
          <For each={ratings()}>{(x) => <RatingRow rating={x} />}</For>
          <Show when={average()}>
            {(avg) => (
              <div class="flex items-center justify-between border-t border-line pt-1.5 text-muted">
                <span>Average</span>
                <span class="font-medium text-fg tabular-nums">{avg()}%</span>
              </div>
            )}
          </Show>
        </Show>
      </section>

      <Show when={p.resolved.metas().length > 1}>
        <div class="border-t border-line px-3 py-2">
          <MatchPicker resolved={p.resolved} />
        </div>
      </Show>

      <For each={groups()}>
        {(g) => (
          <section class="space-y-1.5 border-t border-line px-3 py-2.5">
            <Show when={g.label}>
              <h3 class="text-subtle">{g.label}</h3>
            </Show>
            <div class="flex flex-wrap gap-1">
              <For each={g.links}>
                {(l) => (
                  <a
                    href={l.disabled ? undefined : l.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={l.disabled}
                    title={l.disabled ? 'Waiting for the title to be matched' : l.url}
                    class="rounded px-1.5 py-0.5 ring-1 ring-line"
                    classList={{
                      'text-accent hover:bg-accent-soft hover:ring-accent': !l.disabled,
                      'text-subtle cursor-default': l.disabled,
                    }}
                  >
                    {l.label}
                  </a>
                )}
              </For>
            </div>
          </section>
        )}
      </For>

      <For each={failed()}>
        {(x) => (
          <p class="border-t border-line px-3 py-1.5 text-subtle">
            <Failure name={x.name} query={x.q} />
          </p>
        )}
      </For>
    </div>
  )
}

const RatingRow = (p: { rating: Rating }) => {
  const pct = () => Ratings.percent(p.rating)
  return (
    <div class="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2">
      <Show when={p.rating.url} fallback={<span class="truncate text-muted">{p.rating.label}</span>}>
        {(url) => (
          <a href={url()} target="_blank" rel="noreferrer" class="truncate text-muted hover:text-fg">
            {p.rating.label}
          </a>
        )}
      </Show>
      <div class="h-1.5 overflow-hidden rounded-full bg-hover">
        <div class="h-full rounded-full bg-accent" style={{ width: `${pct()}%` }} />
      </div>
      <span
        class="text-right font-medium tabular-nums"
        title={p.rating.count ? `${p.rating.count.toLocaleString()} ratings` : undefined}
      >
        {Ratings.display(p.rating)}
        <Show when={p.rating.count}>
          {(n) => <span class="ml-1 font-normal text-subtle">{Ratings.count(n())}</span>}
        </Show>
      </span>
    </div>
  )
}

/** Which Cinemeta entry the page's title is, when the search found several. */
export const MatchPicker = (p: { resolved: Resolve.Resolved }) => (
  <select
    class="w-full min-w-0 rounded bg-raised px-2 py-1 text-fg outline-none ring-1 ring-line focus:ring-accent"
    value={p.resolved.meta()?.id}
    onChange={(e) => p.resolved.setMetaId(e.currentTarget.value)}
  >
    <For each={p.resolved.metas()}>
      {(m) => (
        <option value={m.id}>
          {m.name} ({m.releaseInfo ?? m.year ?? '?'})
        </option>
      )}
    </For>
  </select>
)

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** A link back to the site we're on is noise. */
const isHere = (url: string) => {
  try {
    return new URL(url).hostname === location.hostname
  } catch {
    return false
  }
}
