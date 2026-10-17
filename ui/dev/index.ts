import { chromium } from 'playwright'

const run = async (p: { sites: string[]; script: { type?: string; src: string } }) => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-features=LocalNetworkAccessChecks'],
  })

  const context = await browser.newContext()

  // Fix 1: Use 'of' instead of 'in' to get actual URLs
  for (const site of p.sites) {
    const page = await context.newPage()

    // Fix 2 & 3: Safe injection + SPA navigation listener
    await page.addInitScript((scriptConfig) => {
      const inject = () => {
        // Prevent duplicate script tags if one already exists
        const existing = document.querySelector(`script[src="${scriptConfig.src}"]`)
        if (existing) existing.remove()

        const s = document.createElement('script')
        if (scriptConfig.type) s.type = scriptConfig.type
        s.src = scriptConfig.src

        // Target head or documentElement so it works before body is ready
        ;(document.head || document.documentElement).appendChild(s)
        console.log('[Injected] Script added on URL:', window.location.href)
      }

      // 1. Initial page load (wait until DOM is parseable)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject, { once: true })
      } else {
        inject()
      }

      // 2. Intercept SPA routing (pushState & replaceState)
      const patchHistoryMethod = (type: 'pushState' | 'replaceState') => {
        const original = history[type]
        history[type] = function (...args) {
          const result = original.apply(this, args)
          // Wait a tick for the route to settle, then re-inject
          setTimeout(inject, 50)
          return result
        }
      }

      patchHistoryMethod('pushState')
      patchHistoryMethod('replaceState')

      // 3. Handle browser Back/Forward buttons
      window.addEventListener('popstate', () => setTimeout(inject, 50))
    }, p.script)

    await page.goto(site)

    await Promise.race([
      page.click('#onetrust-reject-all-handler', { timeout: 10_000 }),

      page.click('.fc-cta-do-not-consent', { timeout: 10_000 }),
    ]).catch(() => {})
  }
}

run({
  script: { src: 'http://localhost:5173/src/index.tsx', type: 'module' },
  sites: [
    'https://www.rottentomatoes.com/browse/tv_series_browse/sort:popular',
    // 'https://letterboxd.com/official/list/letterboxds-top-500-films/'
    // 'https://www.metacritic.com/browse/movie/',
  ],
})
