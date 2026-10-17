/** On/off switch shared by the background worker and the content script. */
const KEY = 'enabled'

export const get = async () => {
  const { [KEY]: value } = await chrome.storage.local.get(KEY)
  return value !== false
}

export const set = (value: boolean) => chrome.storage.local.set({ [KEY]: value })

/** Call `fn` with the current value, then again whenever it changes. */
export const watch = (fn: (value: boolean) => void) => {
  get().then(fn)
  chrome.storage.local.onChanged.addListener((changes) => {
    if (KEY in changes) fn(changes[KEY].newValue !== false)
  })
}
