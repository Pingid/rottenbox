import { persistQueryClient, type PersistedClient, type Persister } from '@tanstack/query-persist-client-core'
import { QueryClient, QueryClientProvider, useQueries, useQuery } from '@tanstack/solid-query'

import type * as Persist from './persist'

import { Time, Req } from '../lib'

/** Bump when cached data shapes change to drop old persisted entries. */
const BUSTER = '1'
const KEY = 'query-cache'

export const client = new QueryClient({
  defaultOptions: {
    // per-query staleTime / gcTime live with each api's `queries`
    // transient failures (timeouts, 5xx…) retry with backoff; see `Req.retry`
    queries: { gcTime: Time.day, retry: Req.retry, retryDelay: Req.retryDelay, refetchOnWindowFocus: false },
  },
})

export const use = useQuery
export const useAll = useQueries
export const Provider = QueryClientProvider

export const persistant = (s: Persist.AsyncStorage) => {
  const [, restore] = persistQueryClient({
    queryClient: client,
    persister: persister(s),
    // must cover the longest per-query gcTime (cinemeta: 30 days)
    maxAge: 30 * Time.day,
    buster: BUSTER,
  })

  /** Resolves once the persisted cache is loaded; render after it to avoid refetching. */
  return restore.catch(() => {})
}

/**
 * IndexedDB persister. Uses its own db so it can't collide with the host
 * page's idb-keyval store, and batches writes since every cache event
 * triggers one.
 */
const persister = (storage: Persist.AsyncStorage<Record<string, PersistedClient>>): Persister => {
  // const store = createStore('torrenty', 'cache')
  let pending: PersistedClient | undefined
  return {
    persistClient: (c) => {
      const idle = !pending
      pending = c
      if (!idle) return
      setTimeout(() => {
        storage.set(KEY, pending!)
        pending = undefined
      }, Time.second)
    },
    restoreClient: () => storage.get(KEY),
    removeClient: () => storage.del(KEY),
  }
}
