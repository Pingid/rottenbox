#!/bin/sh
# Install or update Rottenbox from its GitHub releases (macOS / Linux).
#
#   curl -fsSL https://github.com/Pingid/rottenbox/releases/latest/download/install.sh | sh
#   curl -fsSL …/install.sh | sh -s -- firefox --version v1.2.3
#
# Arguments: [chrome|firefox] [--version vX.Y.Z]; no browser = every one found.
# ROTTENBOX_RELEASE_URL serves assets from elsewhere (e.g. a local release/ dir).
set -eu

GH=https://github.com/Pingid/rottenbox/releases
CHROME_DIR="${ROTTENBOX_HOME:-$HOME/.rottenbox}/chrome"

browser=""
tag=""
while [ $# -gt 0 ]; do
  case "$1" in
    chrome | firefox) browser="$1" ;;
    --version) tag="${2:?--version needs a tag, e.g. v1.2.3}"; shift ;;
    --version=*) tag="${1#--version=}" ;;
    -h | --help) sed -n '2,9p' "$0" 2>/dev/null || true; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

has curl || die "curl is required"
os=$(uname -s)

# --- release lookup ----------------------------------------------------------

# Latest tag from the /releases/latest redirect; avoids the rate-limited API.
latest_tag() {
  curl -fsSI "$GH/latest" 2>/dev/null | tr -d '\r' | sed -n 's#^[Ll]ocation: .*/tag/\(.*\)$#\1#p' | tail -n 1
}

if [ -z "$tag" ] && [ -z "${ROTTENBOX_RELEASE_URL:-}" ]; then
  tag=$(latest_tag) || true
  [ -n "$tag" ] || die "couldn't find the latest release at $GH"
fi

asset_url() {
  if [ -n "${ROTTENBOX_RELEASE_URL:-}" ]; then
    printf '%s/%s' "${ROTTENBOX_RELEASE_URL%/}" "$1"
  else
    printf '%s/download/%s/%s' "$GH" "$tag" "$1"
  fi
}

# --- browser detection -------------------------------------------------------

app() { [ -d "/Applications/$1.app" ] || [ -d "$HOME/Applications/$1.app" ]; }

# the first chromium-family browser found: a macOS app name or a Linux command
find_chrome() {
  if [ "$os" = Darwin ]; then
    for a in "Google Chrome" "Chromium" "Brave Browser" "Microsoft Edge"; do
      if app "$a"; then printf '%s' "$a"; return 0; fi
    done
  else
    for c in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
      if has "$c"; then printf '%s' "$c"; return 0; fi
    done
  fi
  return 1
}

has_firefox() { if [ "$os" = Darwin ]; then app Firefox; else has firefox; fi; }

# open a url in a browser without blocking; failures are fine, we print it too
open_in() {
  [ -z "${ROTTENBOX_NO_OPEN:-}" ] || return 1 # headless / tests: just print
  if [ "$os" = Darwin ]; then
    open -a "$1" "$2" >/dev/null 2>&1 || return 1
  else
    has "$1" || return 1
    nohup "$1" "$2" >/dev/null 2>&1 &
  fi
}

# --- installers --------------------------------------------------------------

install_chrome() {
  has unzip || die "unzip is required (e.g. apt install unzip)"
  current=$(cat "$CHROME_DIR/.version" 2>/dev/null || true)
  if [ -n "$tag" ] && [ "$current" = "$tag" ]; then
    say "Chrome: Rottenbox $tag is up to date in $CHROME_DIR"
    return 0
  fi

  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT
  say "Chrome: downloading Rottenbox ${tag:-(local build)}…"
  curl -fsSL "$(asset_url rottenbox-chrome.zip)" -o "$work/chrome.zip" || die "download failed: $(asset_url rottenbox-chrome.zip)"
  unzip -q "$work/chrome.zip" -d "$work/chrome"
  [ -f "$work/chrome/manifest.json" ] || die "the download doesn't look like an extension (no manifest.json)"
  printf '%s' "$tag" >"$work/chrome/.version"

  # same path every time: Chrome derives an unpacked extension's id (and so its saved settings) from it
  mkdir -p "$(dirname "$CHROME_DIR")"
  rm -rf "$CHROME_DIR"
  mv "$work/chrome" "$CHROME_DIR"

  if [ -z "$current" ]; then
    say ""
    say "Rottenbox is unpacked at:"
    say "  $CHROME_DIR"
    say ""
    say "Chrome only installs Web Store extensions directly, so load it once by hand:"
    say "  1. Open chrome://extensions"
    say "  2. Turn on Developer mode (top right)"
    say "  3. Click Load unpacked and choose the folder above"
    say ""
    say "Re-run this script to update."
    if b=$(find_chrome); then open_in "$b" chrome://extensions || true; fi
  else
    say "Chrome: updated to ${tag:-the local build}. Click the reload icon on Rottenbox in chrome://extensions, or restart Chrome."
  fi
}

install_firefox() {
  url=$(asset_url rottenbox-firefox.xpi)
  if [ "$os" = Darwin ]; then ff=Firefox; else ff=firefox; fi
  if has_firefox && open_in "$ff" "$url"; then
    say "Firefox: opened the installer. Accept the prompt; Firefox keeps Rottenbox updated from then on."
  else
    say "Firefox: open this link in Firefox to install (it updates itself afterwards):"
    say "  $url"
  fi
}

# --- main --------------------------------------------------------------------

case "$browser" in
  chrome) install_chrome ;;
  firefox) install_firefox ;;
  *)
    found=""
    if find_chrome >/dev/null; then install_chrome; found=1; fi
    if has_firefox; then install_firefox; found=1; fi
    [ -n "$found" ] || install_chrome
    ;;
esac
