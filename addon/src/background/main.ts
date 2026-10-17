import * as Enabled from '@/lib/enabled'

const icon = (name: string) =>
  Object.fromEntries([16, 32, 48, 128].map((size) => [size, `/icons/${name}-${size}.png`]))

/** Reflect the state on the toolbar icon: the stinky tomato when on, plain when off. */
const show = (enabled: boolean) => {
  chrome.action.setIcon({ path: icon(enabled ? 'icon-active' : 'icon') })
  chrome.action.setTitle({ title: `Rottenbox: ${enabled ? 'on' : 'off'} (click to turn ${enabled ? 'off' : 'on'})` })
}

// the service worker restarts often; resync the icon each time it wakes
Enabled.watch(show)

chrome.action.onClicked.addListener(async () => Enabled.set(!(await Enabled.get())))
