import { createStore, del, get, set } from 'idb-keyval'
import { createContext, useContext } from 'solid-js'

export interface AsyncStorage<T extends Record<string, any> = Record<string, any>> {
  get: <K extends keyof T & string>(key: K) => Promise<T[K] | undefined>
  set: <K extends keyof T & string>(key: K, v: T[K]) => Promise<void>
  del: <K extends keyof T & string>(key: K) => Promise<void>
  sub: <K extends keyof T & string>(key: K, listener: (v: T[K] | null) => void) => () => void
}

const Context = createContext<AsyncStorage>()
export const Provider = Context.Provider

export const use = <T extends Record<string, any> = Record<string, any>>() => useContext(Context) as AsyncStorage<T>

export const idb = <T extends Record<string, any>>(name: string): AsyncStorage<T> => {
  const s = createStore('rottenbox', name)
  const listeners = new Map<string, Set<(x: any) => void>>()
  const change = (k: string, v: any) => listeners.get(k)?.forEach((cb) => cb(v))

  return {
    get: (k) => get(k, s) as any,
    set: (k, v) => (change(k, v), set(k, v, s) as any),
    del: (k) => (change(k, null), del(k, s) as any),
    sub: (k, l) => {
      let all = listeners.get(k)
      if (!all) listeners.set(k, (all = new Set()))
      all.add(l)
      return () => all.delete(l)
    },
  }
}
