#!/bin/sh
# Sign the Firefox build on addons.mozilla.org (unlisted: self-distributed, no
# store listing) and write the updates.json its `update_url` points at.
# Run after bin/build.sh.
#
#   VERSION         release tag, e.g. v1.2.3 (required; must match the built manifest)
#   AMO_JWT_ISSUER  AMO API key (Developer Hub → Manage API Keys)
#   AMO_JWT_SECRET  AMO API secret
#   REPO            owner/name for download links (default: Pingid/rottenbox)
set -eu

cd "$(dirname "$0")/.."
: "${VERSION:?set VERSION to the release tag, e.g. v1.2.3}"
: "${AMO_JWT_ISSUER:?missing AMO_JWT_ISSUER}"
: "${AMO_JWT_SECRET:?missing AMO_JWT_SECRET}"
repo="${REPO:-Pingid/rottenbox}"
out=./release
version="${VERSION#v}"
id=$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' ./addon/dist/firefox/manifest.json | head -n 1)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# the bundle is minified, so AMO wants the source it was built from
git archive --format=zip -o "$work/source.zip" HEAD

(cd addon && bunx web-ext sign \
  --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --source-dir dist/firefox \
  --artifacts-dir "$work/signed" \
  --upload-source-code "$work/source.zip")

mv "$work"/signed/*.xpi "$out/rottenbox-firefox.xpi"

# pinned to this tag's asset (not latest/), so the link always matches the version it names
cat >"$out/updates.json" <<EOF
{
  "addons": {
    "$id": {
      "updates": [
        {
          "version": "$version",
          "update_link": "https://github.com/$repo/releases/download/$VERSION/rottenbox-firefox.xpi"
        }
      ]
    }
  }
}
EOF

ls -l "$out/rottenbox-firefox.xpi" "$out/updates.json"
