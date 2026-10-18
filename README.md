# Rottenbox

A panel for movie and TV pages on Rotten Tomatoes, Letterboxd and Metacritic that compares ratings side by side and links out to wherever the title might be streaming. It ships as a Chrome and Firefox extension.

Out of the box it shows the page's own scores (Tomatometer, Popcornmeter, Letterboxd, Metascore) next to IMDb's, plus links to streaming services and film databases. Everything it reads or links to is a **source**, and you can add your own:

- **Links**: url templates like `https://www.netflix.com/search?q={title}`
- **Stremio addons**: any addon serving streams (http, debrid, torrent, external) adds a Streams tab
- **HTTP**: a json api, mapped to ratings or links with dot paths

Sources, actions and backups all share one JSON format, the [Rottenbox manifest](docs/manifest.md), so a set of sources can be shared as a file or url and added in one paste.

```bash
curl -fsSL https://github.com/Pingid/rottenbox/releases/latest/download/install.sh | sh
```

```powershell
irm https://github.com/Pingid/rottenbox/releases/latest/download/install.ps1 | iex
```

See [`addon/`](addon/README.md) for install details, development and releases, and [`ui/`](ui/README.md) for the panel itself.
