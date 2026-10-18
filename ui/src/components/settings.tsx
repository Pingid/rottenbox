import { createSignal, For, onCleanup, Show, type JSX } from 'solid-js'

import { CheckIcon, CloseIcon, IconButton, inputClass } from './ui'
import { Clipboard } from '../lib'
import { Backup, Config, Theme } from '../context'

const newId = Config.newId

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

      <Section
        title="Providers"
        description="Stremio addons searched for torrents, in order. Paste the addon's url or manifest link, including any configuration."
        aside={<ResetButton onReset={() => setConfig('providers', structuredClone(Config.DEFAULT_PROVIDERS))} />}
      >
        <For each={config.providers}>
          {(provider, i) => (
            <Card
              label={provider.label}
              placeholder="Provider name"
              onLabel={(v) => setConfig('providers', i(), 'label', v)}
              onRemove={() => setConfig('providers', (ps) => ps.filter((x) => x.id !== provider.id))}
              enabled={provider.enabled}
              onToggle={(v) => setConfig('providers', i(), 'enabled', v)}
            >
              <input
                aria-label="Addon url"
                class={`${inputClass} font-mono`}
                placeholder="https://torrentio.strem.fun/manifest.json"
                value={provider.url}
                onInput={(e) => setConfig('providers', i(), 'url', e.currentTarget.value)}
              />
            </Card>
          )}
        </For>
        <AddButton
          label="Add provider"
          onClick={() => setConfig('providers', (ps) => [...ps, { id: newId(), label: '', url: '', enabled: true }])}
        />
      </Section>

      <Section
        title="Actions"
        description={
          <>
            Shown on each torrent. <b class="font-medium text-fg">Link</b> opens the url (magnet, player, site); any
            other method sends it as a request, e.g. to a download client. Click a placeholder to copy it.
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
          onClick={() => setConfig('actions', (as) => [...as, Config.newAction(newId())])}
        />
      </Section>

      <BackupSection />
    </div>
  )
}

/** Export settings as a JSON file / clipboard text, and import one back (replacing providers and actions). */
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
    const m = parsed.manifest
    setConfig({ quality: m.quality, providers: m.providers, actions: m.actions })
    theme.setMode(m.theme)
    setText('')
    const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
    setStatus({
      ok: true,
      message: `Imported ${count(m.providers.length, 'provider')} and ${count(m.actions.length, 'action')}.`,
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
      description="Save your providers, actions and theme as JSON, to restore later or move to another browser. Request headers are included, so keep the file private if they hold tokens."
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
