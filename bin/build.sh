#!/bin/sh
# Build everything and collect the release assets into ./release.
#
# Asset names carry no version, so `releases/latest/download/<name>` always
# resolves to the newest build (the install scripts rely on this).
#
#   VERSION  release tag, e.g. v1.2.3 (optional; baked into the manifests)
#   KEY      path to the Chrome signing key (optional; without it no .crx is packed)
set -eu

cd "$(dirname "$0")/.."
out=./release

rm -rf "$out" ./addon/release
export VERSION="${VERSION:-}"
[ -n "$VERSION" ] || unset VERSION
bun run build
mkdir -p "$out"

# standalone bundle of the panel
cp ./ui/dist/rottenbox.js "$out/rottenbox.js"

# chrome: unpacked zip, plus a signed crx when a key is available
cp ./addon/release/chrome.zip "$out/rottenbox-chrome.zip"
if [ -n "${KEY:-}" ]; then
  bunx crx3 pack ./addon/dist/chrome -p "$KEY" -o "$out/rottenbox-chrome.crx"
fi

# firefox: unsigned; bin/sign-firefox.sh adds the signed .xpi and updates.json
cp ./addon/release/firefox.zip "$out/rottenbox-firefox.zip"

# install scripts, served from the release so `latest/download/install.sh` works
for f in install.sh install.ps1; do
  if [ -f "./bin/$f" ]; then cp "./bin/$f" "$out/$f"; fi
done

ls -l "$out"
