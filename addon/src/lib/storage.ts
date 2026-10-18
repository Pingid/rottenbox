import type * as Persist from '@rottenbox/ui/context/persist'

export type ChromeStorage =
  | chrome.storage.LocalStorageArea
  | chrome.storage.StorageArea
  | chrome.storage.SyncStorageArea
  | chrome.storage.SessionStorageArea

export const storage = (storage: ChromeStorage = chrome.storage.local): Persist.AsyncStorage => ({
  get: (k) => storage.get(k).then((x) => x[k]),
  set: (k, v) => storage.set({ [k]: v }),
  del: (k) => storage.remove(k),
  sub: (k, l) => {
    const lis = (c: { [key: string]: chrome.storage.StorageChange }) => {
      console.log({ c })
      if (k in c) l(c[k])
    }
    storage.onChanged.addListener(lis)
    return () => storage.onChanged.removeListener(lis)
  },
})
