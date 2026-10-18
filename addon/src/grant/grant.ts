import { origin as toOrigin } from '@/lib/access'

// only ever ask for the origin named in our own url, normalized
const origin = toOrigin(new URLSearchParams(location.search).get('origin') ?? '')

const $ = (id: string) => document.getElementById(id)!

$('origin').textContent = origin ?? 'an invalid address'
$('cancel').addEventListener('click', () => window.close())
$('allow').addEventListener('click', async () => {
  if (!origin) return window.close()
  // must run in this click handler: browsers only prompt from a user gesture
  await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false)
  window.close()
})
if (!origin) ($('allow') as HTMLButtonElement).disabled = true
