# rottenbox ui

The panel injected into movie sites: ratings compared on one scale, links out, and streams from any Stremio addons you add.

- **Rotten Tomatoes**: the panel opens on movie and TV pages (`/m/*`, `/tv/*`,
  including season and episode pages, which preselect that episode); browse
  grids get a button on each poster.
- **Letterboxd**: the panel opens on film pages (matched by the page's IMDb
  link); every poster (lists, browse, sidebars) gets a button.
- **Metacritic**: movie and TV pages, and posters on browse pages.

Drag the header to move the panel, drag either bottom corner to resize, and
double-click the header to reset. Position, size, the open tab and the quality
filter are remembered.

```bash
bun install
bun run dev     # http://localhost:5173 proxies a live Rotten Tomatoes page with the panel injected
bun run build   # dist/rottenbox.js, inject via userscript/bookmarklet
```

## Views

- **Overview**: the page's own scores, IMDb's (via Cinemeta), and any http
  rating sources, each as a bar on a 0–100 scale with its native value and an
  average. Below that, one row of link chips per links source.
- **Streams**: shown once an enabled Stremio addon exists. Rows from every
  addon that serves the title (checked against its `manifest.json`), de-duplicated,
  with a quality filter and an episode picker for series.

## Sources

Open the ⚙ to edit sources. Paste a Stremio addon (install link, `manifest.json`
or base url) or a [Rottenbox manifest](../docs/manifest.md) (url or json) to
add it, or start a blank one of any kind. Each source can be toggled, renamed
or removed; **Reset** restores the default link packs.

## Actions

Each stream row gets a button per **action**: a **link** (opens a url) or a
request (any other method, e.g. to a download client), plus a copy button.
Actions using a placeholder the stream lacks are hidden, so the default
**Magnet** shows on torrents and **Open** on http streams.

Placeholders, in every url: `{title}` `{year}` `{type}` `{imdb}` `{id}`
`{season}` `{episode}`, and on stream rows `{magnet}` `{hash}` `{name}`
`{fileIdx}` `{url}` (`{{magnet}}` works too). Urls are url-encoded; action
bodies are escaped to match the `Content-Type` header (json, form, or raw
text; guessed when unset), e.g. body `{"magnet": "{magnet}"}`.

Without the extension, requests go straight from the movie site's page, so
the target must allow CORS from that origin.

Settings are saved under `rottenbox:config` in the storage the host provides
(`chrome.storage.local` in the extension).

## Adding a site

Add an adapter in `src/sites/` (`match(url)`, `getMedia(doc)`, optionally
`getRatings(doc)` for the page's own scores and `listItems(doc)` for
per-item buttons) and register it in `src/sites/index.ts`.
