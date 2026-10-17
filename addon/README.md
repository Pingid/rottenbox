# Rottenbox

Browser extension that adds a torrent panel to movie and TV pages on Rotten Tomatoes, Letterboxd and Metacritic. The panel itself lives in [`../ui`](../ui); this package wraps it as a Chrome (Manifest V3) extension.

Click the toolbar icon to turn the extension on or off everywhere. The tomato loses its stink lines while it's off. Open tabs update straight away.

## Development

```bash
bun install
bun run dev
```

Open `chrome://extensions/`, enable **Developer mode**, and **Load unpacked** from `addon/dist`.

## Release

```bash
bun run build
```

Produces `dist/` and a store-ready zip at `release/rottenbox-<version>.zip`. Bump `version` in `package.json` before each upload.

## Structure

- `manifest.config.ts` – extension manifest
- `src/content/` – content script; mounts the UI when enabled
- `src/background/` – toggles on icon click and swaps the icon
- `src/lib/enabled.ts` – on/off state in `chrome.storage.local`
- `icons/` – SVG sources for the toolbar icons; PNGs in `public/icons/`

## Permissions

- `storage` – remembers whether the extension is enabled
- Content script on `rottentomatoes.com`, `letterboxd.com` and `metacritic.com` only
