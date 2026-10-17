# torrenty client

A compact torrent panel injected into movie sites.

- **Rotten Tomatoes**: the panel opens on movie and TV pages (`/m/*`, `/tv/*`,
  including season and episode pages, which preselect that episode); browse
  grids get a ⇣ button on each poster.
- **Letterboxd**: the panel opens on film pages (matched by the page's IMDb
  link); every poster (lists, browse, sidebars) gets a ⇣ button.

Drag the header to move the panel, drag either bottom corner to resize, and
double-click the header to reset. Position, size and the quality filter are remembered.

```bash
bun install
bun run dev     # http://localhost:5173 renders the panel against a fixture movie
bun run build   # dist/bundle.js — inject via userscript/bookmarklet
```

## Links and actions

Open the ⚙ in the panel. Each torrent row gets a button per **link** (opens a
url) and per **action** (sends an http request, e.g. to a download client),
plus a copy-magnet button.

Placeholders: `{magnet}` `{hash}` `{name}` `{title}` `{year}` `{imdb}`
`{season}` `{episode}` `{fileIdx}` (`{{magnet}}` works too). Urls are
url-encoded; action bodies are escaped to match the `Content-Type` header
(json, form, or raw text; guessed when unset), e.g. body `{"magnet": "{magnet}"}`.

Actions call the target server from the movie site's page, so it must allow
CORS from that origin, and Chrome may ask to allow access to local-network
devices the first time.

Settings are saved to the host site's `localStorage` under `torrenty:config`.

## Adding a site

Add an adapter in `src/sites/` (`match(url)`, `getMedia(doc)`, and optionally
`listItems(doc)` for per-item buttons) and register it in `src/sites/index.ts`.
