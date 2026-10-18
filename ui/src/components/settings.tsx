import { createSignal, For, onCleanup, Show, type JSX } from 'solid-js'

import { CheckIcon, CloseIcon, IconButton, inputClass } from './ui'
import { Clipboard, Manifest, Req } from '../lib'
import { Backup, Config, Fetch, Theme } from '../context'

/** Signal that falls back to `false` a moment after being set. */
const createFlash = (ms: number) => {
  const [on, setOn] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  const flash = () => {
    setOn(true)
    clearTimeout(timer)
    timer = setTimeout(() => setOn(false), ms)
  }
  return [on, flash, () => (clearTimeout(timer), setOn(false))] as const
}

/** Two-step reset: the first click arms it, a second within a few seconds confirms. */
const ResetButton = (p: { onReset: () => void }) => {
  const [armed, arm, disarm] = createFlash(3000)
  return (
    <button
      type="button"
      class="rounded px-1.5 py-0.5 text-subtle hover:bg-hover hover:text-muted"
      classList={{ 'text-danger! hover:text-danger!': armed() }}
      onClick={() => (armed() ? (disarm(), p.onReset()) : arm())}
    >
      {armed() ? 'Confirm reset' : 'Reset'}
    </button>
  )
}

const Section = (p: { title: string; description?: JSX.Element; aside?: JSX.Element; children?: JSX.Element }) => (
  <section class="space-y-2.5 px-3 py-3">
    <header class="space-y-1">
      <div class="flex min-h-6 items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">{p.title}</h3>
        {p.aside}
      </div>
      <Show when={p.description}>
        <p class="leading-relaxed text-muted">{p.description}</p>
      </Show>
    </header>
    {p.children}
  </section>
)

/** Bordered card for one list entry: a header row (toggle, label, remove) above its fields. */
const Card = (p: {
  label: string
  badge?: string
  placeholder: string
  onLabel: (v: string) => void
  onRemove: () => void
  enabled?: boolean
  onToggle?: (v: boolean) => void
  children: JSX.Element
}) => (
  <div class="rounded-md ring-1 ring-line" classList={{ 'opacity-60': p.enabled === false }}>
    <div class="flex items-center gap-1.5 border-b border-line py-1 pr-1 pl-2.5">
      <Show when={p.onToggle}>{(toggle) => <Switch checked={!!p.enabled} label="Enabled" onChange={toggle()} />}</Show>
      <input
        class="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 font-medium text-fg outline-none placeholder:font-normal placeholder:text-subtle focus:bg-raised"
        placeholder={p.placeholder}
        value={p.label}
        onInput={(e) => p.onLabel(e.currentTarget.value)}
      />
      <Show when={p.badge}>
        <span class="shrink-0 rounded bg-raised px-1 text-subtle ring-1 ring-line">{p.badge}</span>
      </Show>
      <IconButton title="Remove" onClick={p.onRemove}>
        <CloseIcon />
      </IconButton>
    </div>
    <div class="space-y-2 p-2.5">{p.children}</div>
  </div>
)

const Field = (p: { label: string; hint?: string; children: JSX.Element }) => (
  <label class="block space-y-1">
    <span class="flex items-baseline justify-between gap-2 text-muted">
      {p.label}
      <Show when={p.hint}>
        <span class="text-subtle">{p.hint}</span>
      </Show>
    </span>
    {p.children}
  </label>
)

const Switch = (p: { checked: boolean; label: string; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={p.checked}
    title={p.checked ? 'Enabled' : 'Disabled'}
    aria-label={p.label}
    onClick={() => p.onChange(!p.checked)}
    class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
    classList={{ 'bg-accent': p.checked, 'bg-line-strong': !p.checked }}
  >
    <span
      class="absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform"
      classList={{ 'translate-x-3': p.checked }}
    />
  </button>
)

/** Small inline segmented control, sized to its labels. */
const Segmented = <T extends string>(p: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) => (
  <div class="inline-flex gap-0.5 rounded-md bg-raised p-0.5 ring-1 ring-line">
    <For each={p.options}>
      {(o) => (
        <button
          type="button"
          aria-pressed={p.value === o.value}
          onClick={() => p.onChange(o.value)}
          class="rounded px-2 py-px text-muted hover:text-fg"
          classList={{ 'bg-surface text-fg! shadow-sm ring-1 ring-line': p.value === o.value }}
        >
          {o.label}
        </button>
      )}
    </For>
  </div>
)

const AddButton = (p: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={p.onClick}
    class="w-full rounded-md border border-dashed border-line-strong py-1.5 text-muted hover:border-accent hover:bg-accent-soft hover:text-accent"
  >
    + {p.label}
  </button>
)

/** `{placeholder}` chip; click to copy it. */
const Placeholder = (p: { name: string }) => {
  const [copied, flash] = createFlash(1200)
  const text = `{${p.name}}`
  return (
    <button
      type="button"
      title="Copy"
      onClick={async () => (await Clipboard.copy(text)) && flash()}
      class="inline-flex items-center gap-0.5 rounded bg-raised px-1 font-mono text-fg ring-1 ring-line hover:ring-accent"
    >
      {text}
      <Show when={copied()}>
        <span class="text-ok">
          <CheckIcon />
        </span>
      </Show>
    </button>
  )
}

const Placeholders = () => (
  <div class="flex flex-wrap gap-1">
    <For each={Config.PLACEHOLDERS}>{(k) => <Placeholder name={k} />}</For>
  </div>
)

const THEMES: { value: Theme.Mode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export const Settings = () => {
  const { config, setConfig } = Config.use()
  const theme = Theme.use()

  return (
    <div class="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
      <Section title="Theme" aside={<Segmented value={theme.mode()} options={THEMES} onChange={theme.setMode} />} />

      <SourcesSection />

      <Section
        title="Actions"
        description={
          <>
            Shown on each stream. <b class="font-medium text-fg">Link</b> opens the url (magnet, player, site); any
            other method sends it as a request, e.g. to a download client. Actions using a placeholder the stream lacks
            (<code>{'{magnet}'}</code> on an http stream) are hidden. Click a placeholder to copy it.
          </>
        }
        aside={<ResetButton onReset={() => setConfig('actions', structuredClone(Config.DEFAULT_ACTIONS))} />}
      >
        <Placeholders />
        <For each={config.actions}>
          {(action, i) => (
            <Card
              label={action.label}
              placeholder="Action name"
              onLabel={(v) => setConfig('actions', i(), 'label', v)}
              onRemove={() => setConfig('actions', (as) => as.filter((a) => a.id !== action.id))}
            >
              <div class="flex gap-1">
                <select
                  aria-label="Method"
                  class={`${inputClass} w-20! shrink-0`}
                  value={action.method}
                  onChange={(e) => setConfig('actions', i(), 'method', e.currentTarget.value as Config.Method)}
                >
                  <For each={Config.METHODS}>{(m) => <option value={m}>{m === 'LINK' ? 'Link' : m}</option>}</For>
                </select>
                <input
                  aria-label="Url"
                  class={`${inputClass} font-mono`}
                  placeholder={
                    Config.isLink(action) ? 'https://example.com/play/{hash}' : 'http://localhost:3030/torrents'
                  }
                  value={action.url}
                  onInput={(e) => setConfig('actions', i(), 'url', e.currentTarget.value)}
                />
              </div>
              <Show when={!Config.isLink(action)}>
                <Field label="Headers" hint="one per line">
                  <textarea
                    class={`${inputClass} resize-y font-mono`}
                    rows={1}
                    placeholder="Authorization: Bearer …"
                    value={action.headers}
                    onInput={(e) => setConfig('actions', i(), 'headers', e.currentTarget.value)}
                  />
                </Field>
                <Field label="Body" hint="escaped to match Content-Type">
                  <textarea
                    class={`${inputClass} resize-y font-mono`}
                    rows={2}
                    placeholder={'{"magnet": "{magnet}"}'}
                    value={action.body}
                    onInput={(e) => setConfig('actions', i(), 'body', e.currentTarget.value)}
                  />
                </Field>
              </Show>
            </Card>
          )}
        </For>
        <AddButton
          label="Add action"
          onClick={() => setConfig('actions', (as) => [...as, Config.newAction(Config.newId())])}
        />
      </Section>

      <BackupSection />
    </div>
  )
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Export settings as a JSON file / clipboard text, and import one back (replacing sources and actions). */
const BackupSection = () => {
  const { config, setConfig } = Config.use()
  const theme = Theme.use()
  const [text, setText] = createSignal('')
  const [status, setStatus] = createSignal<{ ok: boolean; message: string }>()
  const [copied, flashCopied] = createFlash(1200)
  let file!: HTMLInputElement

  const exported = () => Backup.stringify(Backup.toManifest(config, theme.mode()))

  const apply = () => {
    const parsed = Backup.parse(text())
    if (!parsed.ok) return setStatus({ ok: false, message: parsed.error })
    const m = parsed.settings
    setConfig({ quality: m.quality, sources: m.sources, actions: m.actions })
    theme.setMode(m.theme)
    setText('')
    setStatus({
      ok: true,
      message: `Imported ${count(m.sources.length, 'source')} and ${count(m.actions.length, 'action')}.`,
    })
  }

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setText(await f.text())
    setStatus(undefined)
    file.value = '' // so picking the same file again still fires `change`
  }

  const button = 'rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-fg'

  return (
    <Section
      title="Backup"
      description="Save your sources, actions and theme as a Rottenbox manifest, to restore later or move to another browser. Request headers are included, so keep the file private if they hold tokens."
      aside={
        <div class="flex gap-0.5">
          <button
            type="button"
            class={button}
            onClick={async () => (await Clipboard.copy(exported())) && flashCopied()}
          >
            {copied() ? 'Copied' : 'Copy'}
          </button>
          <button type="button" class={button} onClick={() => Backup.download(exported())}>
            Download
          </button>
        </div>
      }
    >
      <textarea
        aria-label="Settings JSON to import"
        class={`${inputClass} resize-y font-mono`}
        rows={3}
        placeholder="Paste settings JSON, or choose a file…"
        value={text()}
        onInput={(e) => (setText(e.currentTarget.value), setStatus(undefined))}
      />
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        class="hidden"
        onChange={(e) => pickFile(e.currentTarget.files?.[0])}
      />
      <div class="flex items-center gap-1">
        <button type="button" class={button} onClick={() => file.click()}>
          Choose file
        </button>
        <span
          class="min-w-0 flex-1 truncate"
          classList={{ 'text-ok': status()?.ok, 'text-danger': status()?.ok === false }}
          title={status()?.message}
        >
          {status()?.message}
        </span>
        <button
          type="button"
          disabled={!text().trim()}
          onClick={apply}
          class="rounded bg-accent px-2 py-0.5 text-white hover:opacity-90 disabled:opacity-40"
        >
          Import
        </button>
      </div>
    </Section>
  )
}

const KIND_LABEL: Record<Manifest.Kind, string> = { stremio: 'Stremio', links: 'Links', http: 'HTTP' }

const PLACEHOLDER: Record<Manifest.Kind, string> = {
  stremio: 'Addon name',
  links: 'Group name, e.g. Watch on',
  http: 'Source name',
}

/** Sources list: one card per source, fields by kind, plus paste-to-add. */
const SourcesSection = () => {
  const { config, setConfig } = Config.use()
  /** merge into source `i`, keeping its kind */
  const set = (i: number, patch: Partial<Manifest.Source>) =>
    setConfig('sources', i, (s) => ({ ...s, ...patch }) as Manifest.Source)

  return (
    <Section
      title="Sources"
      description={
        <>
          Where ratings, links and streams come from. <b class="font-medium text-fg">Links</b> are url templates
          (streaming services, databases); <b class="font-medium text-fg">Stremio</b> addons add a Streams tab;{' '}
          <b class="font-medium text-fg">HTTP</b> sources map a json api to ratings or links. The placeholders under
          Actions work in every url.
        </>
      }
      aside={<ResetButton onReset={() => setConfig('sources', structuredClone(Config.DEFAULT_SOURCES))} />}
    >
      <For each={config.sources}>
        {(source, i) => (
          <Card
            label={source.label}
            badge={KIND_LABEL[source.kind]}
            placeholder={PLACEHOLDER[source.kind]}
            onLabel={(v) => set(i(), { label: v })}
            onRemove={() => setConfig('sources', (ss) => ss.filter((x) => x.id !== source.id))}
            enabled={source.enabled}
            onToggle={(v) => set(i(), { enabled: v })}
          >
            <Show when={source.kind === 'stremio' && source}>
              {(s) => (
                <input
                  aria-label="Addon url"
                  class={`${inputClass} font-mono`}
                  placeholder="https://addon.example/manifest.json"
                  value={s().url}
                  onInput={(e) => set(i(), { url: e.currentTarget.value })}
                />
              )}
            </Show>
            <Show when={source.kind === 'links' && source}>{(s) => <LinksFields source={s()} index={i()} />}</Show>
            <Show when={source.kind === 'http' && source}>{(s) => <HttpFields source={s()} index={i()} />}</Show>
          </Card>
        )}
      </For>
      <AddSource />
    </Section>
  )
}

const LinksFields = (p: { source: Manifest.LinksSource; index: number }) => {
  const { setConfig } = Config.use()
  const setLinks = (fn: (ls: Manifest.Link[]) => Manifest.Link[]) =>
    setConfig('sources', p.index, (s) => (s.kind === 'links' ? { ...s, links: fn(s.links) } : s))
  const setLink = (id: string, patch: Partial<Manifest.Link>) =>
    setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  return (
    <div class="space-y-1">
      <For each={p.source.links}>
        {(link) => (
          <div class="flex gap-1">
            <input
              aria-label="Link label"
              class={`${inputClass} w-24! shrink-0`}
              placeholder="Label"
              value={link.label}
              onInput={(e) => setLink(link.id, { label: e.currentTarget.value })}
            />
            <input
              aria-label="Link url"
              class={`${inputClass} font-mono`}
              placeholder="https://example.com/search?q={title}"
              value={link.url}
              onInput={(e) => setLink(link.id, { url: e.currentTarget.value })}
            />
            <IconButton title="Remove link" onClick={() => setLinks((ls) => ls.filter((l) => l.id !== link.id))}>
              <CloseIcon />
            </IconButton>
          </div>
        )}
      </For>
      <button
        type="button"
        class="rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-fg"
        onClick={() => setLinks((ls) => [...ls, { id: Config.newId(), label: '', url: '' }])}
      >
        + Link
      </button>
    </div>
  )
}

const MAP_FIELDS: { key: keyof Manifest.HttpMap; label: string; hint: string; for?: 'rating' | 'links' }[] = [
  { key: 'items', label: 'Items', hint: 'list path, optional' },
  { key: 'label', label: 'Label', hint: 'path' },
  { key: 'value', label: 'Value', hint: 'path', for: 'rating' },
  { key: 'max', label: 'Max', hint: 'number or path' },
  { key: 'url', label: 'Url', hint: 'path' },
]

const HttpFields = (p: { source: Manifest.HttpSource; index: number }) => {
  const { setConfig } = Config.use()
  const set = (patch: Partial<Manifest.HttpSource>) =>
    setConfig('sources', p.index, (s) => (s.kind === 'http' ? { ...s, ...patch } : s))
  const setMap = (key: keyof Manifest.HttpMap, v: string) => set({ map: { ...p.source.map, [key]: v } })
  const fields = () =>
    MAP_FIELDS.filter((f) => (f.key === 'max' ? p.source.produces === 'rating' : !f.for || f.for === p.source.produces))
  return (
    <>
      <div class="flex items-center gap-1">
        <input
          aria-label="Url"
          class={`${inputClass} font-mono`}
          placeholder="https://api.example.com/title/{imdb}"
          value={p.source.url}
          onInput={(e) => set({ url: e.currentTarget.value })}
        />
        <Segmented
          value={p.source.produces}
          options={[
            { value: 'rating', label: 'Ratings' },
            { value: 'links', label: 'Links' },
          ]}
          onChange={(v) => set({ produces: v })}
        />
      </div>
      <Field label="Headers" hint="one per line">
        <textarea
          class={`${inputClass} resize-y font-mono`}
          rows={1}
          placeholder="Authorization: Bearer …"
          value={p.source.headers}
          onInput={(e) => set({ headers: e.currentTarget.value })}
        />
      </Field>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <For each={fields()}>
          {(f) => (
            <Field label={f.label} hint={f.hint}>
              <input
                class={`${inputClass} font-mono`}
                value={p.source.map[f.key]}
                onInput={(e) => setMap(f.key, e.currentTarget.value)}
              />
            </Field>
          )}
        </For>
      </div>
    </>
  )
}

/** Paste a Stremio addon / Rottenbox manifest (url or json) to add its sources, or start a blank one. */
const AddSource = () => {
  const { setConfig } = Config.use()
  const r = Fetch.use()
  const grant = Fetch.useGrant()
  const [text, setText] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [status, setStatus] = createSignal<{ ok: boolean; message: string; grant?: string }>()

  const add = (sources: Manifest.Source[]) => setConfig('sources', (ss) => [...ss, ...sources])

  const run = async () => {
    setBusy(true)
    setStatus(undefined)
    try {
      const found = await Manifest.detect(r, text())
      if (!found.sources.length) throw new Error('No sources in that manifest.')
      add(found.sources)
      setText('')
      const names =
        found.name ??
        found.sources
          .map((s) => s.label)
          .filter(Boolean)
          .join(', ')
      setStatus({ ok: true, message: `Added ${count(found.sources.length, 'source')}${names ? `: ${names}` : ''}.` })
    } catch (e) {
      const origin = Req.grantOf(e)
      const message = origin
        ? `Rottenbox needs access to ${origin}.`
        : e instanceof Req.ReqError
          ? `Couldn't read that: ${Req.describe(e)}.`
          : e instanceof Error
            ? e.message
            : String(e)
      setStatus({ ok: false, message, grant: origin })
    } finally {
      setBusy(false)
    }
  }

  const button = 'rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-fg'

  return (
    <div class="space-y-1.5 rounded-md border border-dashed border-line-strong p-2">
      <div class="flex gap-1">
        <input
          aria-label="Addon or manifest to add"
          class={`${inputClass} font-mono`}
          placeholder="Stremio addon or Rottenbox manifest url / json"
          value={text()}
          onInput={(e) => (setText(e.currentTarget.value), setStatus(undefined))}
          onKeyDown={(e) => e.key === 'Enter' && text().trim() && !busy() && run()}
        />
        <button
          type="button"
          disabled={!text().trim() || busy()}
          onClick={run}
          class="shrink-0 rounded bg-accent px-2 py-0.5 text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy() ? 'Adding…' : 'Add'}
        </button>
      </div>
      <Show when={status()}>
        {(st) => (
          <p classList={{ 'text-ok': st().ok, 'text-danger': !st().ok }}>
            {st().message}
            <Show when={grant && st().grant}>
              {(o) => (
                <button
                  type="button"
                  class="ml-1.5 rounded px-1.5 text-accent hover:bg-accent-soft"
                  onClick={async () => (await grant!(o())) && run()}
                >
                  Grant access
                </button>
              )}
            </Show>
          </p>
        )}
      </Show>
      <div class="flex items-center gap-0.5 text-subtle">
        <span class="mr-1">or start a blank</span>
        <For each={Manifest.KINDS}>
          {(k) => (
            <button type="button" class={button} onClick={() => add([Manifest.blank(k)])}>
              {KIND_LABEL[k]}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
