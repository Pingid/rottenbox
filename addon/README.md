# Rottenbox

Browser extension that adds a torrent panel to movie and TV pages on Rotten Tomatoes, Letterboxd and Metacritic. The panel itself lives in [`../ui`](../ui); this package wraps it as a Manifest V3 extension for Chrome and Firefox.

Click the toolbar icon to turn the extension on or off everywhere. The tomato loses its stink lines while it's off. Open tabs update straight away.

## Install

From the [latest release](https://github.com/Pingid/rottenbox/releases/latest):

```bash
curl -fsSL https://github.com/Pingid/rottenbox/releases/latest/download/install.sh | sh
```

```powershell
irm https://github.com/Pingid/rottenbox/releases/latest/download/install.ps1 | iex
```

Pass `chrome` or `firefox` to pick one (`sh -s -- firefox`; on Windows set `$env:ROTTENBOX_BROWSER`); with no argument it installs for every browser it finds.

- **Firefox** opens the signed `rottenbox-firefox.xpi`; accept the prompt. It updates itself from then on.
- **Chrome** blocks extensions from outside the Web Store, so the script unpacks the build to `~/.rottenbox/chrome` (Windows: `%LOCALAPPDATA%\Rottenbox\chrome`). The first time, open `chrome://extensions`, enable **Developer mode** and **Load unpacked** that folder. To update, run the script again and click reload on Rottenbox.

## Development

```bash
bun install
bun run dev          # chrome → load unpacked from addon/dist/chrome
bun run dev:firefox  # firefox → addon/dist/firefox
```

For Firefox, `bun run build:firefox && bun run start:firefox` launches a scratch Firefox profile with the extension (needs Firefox installed). `bun run lint:firefox` runs Mozilla's add-on linter.

## Release

```bash
bun run build        # dist/{chrome,firefox} and release/{chrome,firefox}.zip
sh ../bin/build.sh   # collects everything into ../release with stable names
```

Pushing a `v*` tag does the rest in CI (`.github/workflows/main.yml`): builds both browsers with the tag as the manifest version, packs a signed `rottenbox-chrome.crx`, signs the Firefox build on addons.mozilla.org as an **unlisted** add-on (`bin/sign-firefox.sh`), writes the `updates.json` Firefox polls, and publishes it all as a GitHub release along with the install scripts.

Secrets: `CRX_PRIVATE_KEY` (base64 Chrome key), `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` (AMO Developer Hub → Manage API Keys). AMO only signs each version once, so every tag needs a new, higher version. The Firefox id `rottenbox@pingid.github.io` is fixed once signed.

## Structure

- `manifest.config.ts` – extension manifest
- `src/content/` – content script; mounts the UI when enabled
- `src/background/` – toggles on icon click and swaps the icon
- `src/lib/enabled.ts` – on/off state in `chrome.storage.local`
- `icons/` – SVG sources for the toolbar icons; PNGs in `public/icons/`

## Permissions

- `storage` – remembers whether the extension is enabled
- Host access to `v3-cinemeta.strem.io` and `torrentio.strem.fun` – lets the background worker look up titles and torrents without CORS
- Content script on `rottentomatoes.com`, `letterboxd.com` and `metacritic.com` only
