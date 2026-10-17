import { createContext, createSignal, onCleanup, onMount, useContext, type ParentComponent } from 'solid-js'

import * as Persist from './persist'

export type Mode = 'system' | 'light' | 'dark'
export const MODES: Mode[] = ['system', 'light', 'dark']

const KEY = 'rottenbox:theme'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

/**
 * Light or dark. `system` follows the OS; `resolved` is which of the two that
 * currently is. Applied by the app as a `dark` class on its own root inside the
 * shadow tree, never on the host page.
 */
type Ctx = { mode: () => Mode; resolved: () => 'light' | 'dark'; setMode: (m: Mode) => void }

const fallback: Ctx = {
  mode: () => 'system',
  resolved: () => (query().matches ? 'dark' : 'light'),
  setMode: () => {},
}
const Context = createContext<Ctx>(fallback)
export const use = (): Ctx => useContext(Context) ?? fallback

export const Provider: ParentComponent = (p) => {
  const storage = Persist.use<{ [KEY]: Mode }>()
  const [mode, setModeSignal] = createSignal<Mode>('system')
  const [systemDark, setSystemDark] = createSignal(query().matches)

  onMount(() => {
    storage.get(KEY).then((m) => m && MODES.includes(m) && setModeSignal(m))
    const q = query()
    const onChange = () => setSystemDark(q.matches)
    q.addEventListener('change', onChange)
    onCleanup(() => q.removeEventListener('change', onChange))
  })

  const resolved = () => (mode() === 'system' ? (systemDark() ? 'dark' : 'light') : (mode() as 'light' | 'dark'))
  const setMode = (m: Mode) => (setModeSignal(m), storage.set(KEY, m))

  return <Context.Provider value={{ mode, resolved, setMode }}>{p.children}</Context.Provider>
}
