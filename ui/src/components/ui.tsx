import { createSignal, Show, type JSX } from 'solid-js'

import { Req } from '../lib'
import { Fetch, Query } from '../context'

export const IconButton = (p: { title: string; active?: boolean; onClick: () => void; children: JSX.Element }) => (
  <button
    type="button"
    title={p.title}
    onClick={p.onClick}
    class="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
    classList={{ 'bg-hover text-fg': p.active }}
  >
    {p.children}
  </button>
)

const Svg = (p: { children: JSX.Element }) => (
  <svg
    viewBox="0 0 24 24"
    class="size-3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {p.children}
  </svg>
)

export const GearIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const CloseIcon = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

/** Stacked bars: the panel's own "compare" glyph. */
export const BarsIcon = () => (
  <Svg>
    <path d="M4 7h10M4 12h16M4 17h7" />
  </Svg>
)

export const Message = (p: { children: JSX.Element }) => <p class="px-3 py-6 text-center text-muted">{p.children}</p>

export const inputClass =
  'w-full min-w-0 rounded bg-raised px-2 py-1 text-fg outline-none ring-1 ring-line placeholder:text-subtle focus:ring-accent'

export const ChevronIcon = (p: { dir: 'left' | 'right' }) => (
  <Svg>
    <path d={p.dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </Svg>
)

export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
)

export const CheckIcon = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

type Failed = { error: unknown; failureReason?: unknown }

/**
 * "Name: reason" for a failed request. When the extension lacks access to the
 * host, offers to grant it, then retries everything that failed.
 */
export const Failure = (p: { name: string; query: Failed }) => {
  const grant = Fetch.useGrant()
  const [asking, setAsking] = createSignal(false)
  const reason = () => p.query.error ?? p.query.failureReason
  const ask = async (origin: string) => {
    if (!grant) return
    setAsking(true)
    try {
      if (await grant(origin)) await Query.client.refetchQueries({ predicate: (q) => q.state.status === 'error' })
    } finally {
      setAsking(false)
    }
  }
  return (
    <>
      {p.name}: {Req.describe(reason())}
      <Show when={grant && Req.grantOf(reason())}>
        {(origin) => (
          <button
            type="button"
            disabled={asking()}
            title={`Let Rottenbox fetch from ${origin()}`}
            onClick={() => ask(origin())}
            class="ml-1.5 rounded px-1.5 text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            {asking() ? 'Waiting…' : 'Grant access'}
          </button>
        )}
      </Show>
    </>
  )
}
