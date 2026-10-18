# Rottenbox manifest

One JSON format for saved settings, backup files and shareable **packs** of sources. A pack is just a manifest with a `name` and `sources`. Paste one into **Settings → Sources** (as json, or as a url to a `.json` file) and its sources are added to yours. A backup also carries `actions`, `theme` and `quality`, and **Backup → Import** replaces your settings with it.

Schema: [`manifest.schema.json`](manifest.schema.json).

```jsonc
{
  "app": "rottenbox",
  "version": 2,
  "name": "My pack",
  "sources": [
    {
      "kind": "links",
      "id": "watch",
      "label": "Watch on",
      "enabled": true,
      "links": [{ "id": "justwatch", "label": "JustWatch", "url": "https://www.justwatch.com/us/search?q={title}" }],
    },
    { "kind": "stremio", "id": "my-addon", "label": "My addon", "url": "https://addon.example", "enabled": true },
    {
      "kind": "http",
      "id": "scores",
      "label": "Scores API",
      "enabled": true,
      "url": "https://api.example/title/{imdb}",
      "headers": "",
      "produces": "rating",
      "map": { "items": "ratings", "label": "source", "value": "score", "max": "100", "url": "link" },
    },
  ],
}
```

## Top level

| field     |                                                              |
| --------- | ------------------------------------------------------------ |
| `app`     | always `"rottenbox"`                                         |
| `version` | `2`; other versions are refused                              |
| `name`    | optional, shown when a pack is added                         |
| `sources` | list of sources, below; entries of unknown kinds are skipped |
| `actions` | optional, stream row actions (backups)                       |
| `theme`   | optional, `system` \| `light` \| `dark` (backups)            |
| `quality` | optional, stream quality filter (backups)                    |

Every source has `kind`, `id`, `label` and `enabled` (default `true`). Missing ids are generated.

## Placeholders

Any `url` (and http `headers`) can use `{title}` `{year}` `{type}` (`movie` / `series`) `{imdb}` `{id}` (the Stremio video id: imdb id, or `{imdb}:{season}:{episode}`) `{season}` `{episode}`. Values are url-encoded in urls and raw in headers. A link or request whose placeholders have no value yet (e.g. `{imdb}` before the title is matched) is disabled rather than sent half-filled.

## `links`

Chips in the Overview, one row per source, in order. `links` is a list of `{ id, label, url }`. Links pointing at the site you're on are hidden.

## `stremio`

A [Stremio addon](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/README.md). `url` is its base url; a `manifest.json` url or a `stremio://` install link works too, including any configuration in the path. The addon's manifest is read to skip addons that don't serve `stream` for the title's type and id. Streams of every kind are shown: torrents (`infoHash`), http (`url`), `externalUrl` and `ytId`.

## `http`

Fetches `url` (GET, with `headers`, one `Key: Value` per line) and maps the json response with **dot paths** (`a.b.0.c`; empty means the value itself):

| `map` field |                                                                                         |
| ----------- | --------------------------------------------------------------------------------------- |
| `items`     | path to a list; each entry is mapped on its own. Empty: the whole response is one entry |
| `label`     | path to the entry's name; falls back to the source label                                |
| `value`     | ratings: path to the score                                                              |
| `max`       | ratings: a number, or a path; default `10`                                              |
| `url`       | path to a link; links need one, ratings may have one                                    |

`produces` is `"rating"` (bars in the Overview, compared with the other scores) or `"links"` (a chip row). Responses are cached for an hour.

## Actions

Shown on each stream row: `{ id, label, method, url, headers, body }`. `method` `LINK` opens the url; `POST` `PUT` `PATCH` `GET` `DELETE` send it as a request. Stream rows add `{magnet}` `{hash}` `{name}` `{fileIdx}` `{url}`; an action using one the stream lacks is hidden. Bodies are escaped to match `Content-Type` (json, form, or raw text; guessed when unset).

## Access

In the extension, the first request to a new host opens a small prompt asking to allow that one origin. Link sources never need access.
