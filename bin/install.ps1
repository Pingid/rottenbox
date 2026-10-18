# Install or update Rottenbox from its GitHub releases (Windows).
#
#   irm https://github.com/Pingid/rottenbox/releases/latest/download/install.ps1 | iex
#   $env:ROTTENBOX_BROWSER = 'firefox'; irm …/install.ps1 | iex
#   .\install.ps1 -Browser chrome -Version v1.2.3
#
# No browser = every one found. ROTTENBOX_RELEASE_URL serves assets from elsewhere
# (e.g. a local release/ dir); ROTTENBOX_VERSION pins a release.
param(
  [string] $Browser = $env:ROTTENBOX_BROWSER,
  [string] $Version = $env:ROTTENBOX_VERSION
)

$ErrorActionPreference = 'Stop'
if ($Browser -and $Browser -notin @('chrome', 'firefox')) { throw "unknown browser '$Browser' (use chrome or firefox)" }
$ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is far slower with the progress bar
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$GH = 'https://github.com/Pingid/rottenbox/releases'
$Root = if ($env:ROTTENBOX_HOME) { $env:ROTTENBOX_HOME } else { Join-Path $env:LOCALAPPDATA 'Rottenbox' }
$ChromeDir = Join-Path $Root 'chrome'
$Custom = $env:ROTTENBOX_RELEASE_URL

# --- release lookup ----------------------------------------------------------

# Latest tag from the /releases/latest redirect; avoids the rate-limited API.
function Get-LatestTag {
  $req = [Net.HttpWebRequest]::Create("$GH/latest")
  $req.AllowAutoRedirect = $false
  $req.Method = 'HEAD'
  $res = $req.GetResponse()
  try { $loc = $res.Headers['Location'] } finally { $res.Close() }
  if ($loc -match '/tag/([^/]+)$') { return $Matches[1] }
  throw "couldn't find the latest release at $GH"
}

if (-not $Version -and -not $Custom) { $Version = Get-LatestTag }

function Get-AssetUrl([string] $name) {
  if ($Custom) { return "$($Custom.TrimEnd('/'))/$name" }
  return "$GH/download/$Version/$name"
}

# --- browser detection -------------------------------------------------------

function Find-Exe([string[]] $relative) {
  foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
    if (-not $root) { continue }
    foreach ($r in $relative) {
      $p = Join-Path $root $r
      if (Test-Path $p) { return $p }
    }
  }
  return $null
}

function Find-Chrome {
  Find-Exe @(
    'Google\Chrome\Application\chrome.exe',
    'Chromium\Application\chrome.exe',
    'BraveSoftware\Brave-Browser\Application\brave.exe',
    'Microsoft\Edge\Application\msedge.exe'
  )
}

function Find-Firefox { Find-Exe @('Mozilla Firefox\firefox.exe') }

# --- installers --------------------------------------------------------------

function Install-Chrome {
  $versionFile = Join-Path $ChromeDir '.version'
  $current = if (Test-Path $versionFile) { (Get-Content $versionFile -Raw).Trim() } else { '' }
  if ($Version -and $current -eq $Version) {
    Write-Host "Chrome: Rottenbox $Version is up to date in $ChromeDir"
    return
  }

  $work = Join-Path ([IO.Path]::GetTempPath()) ("rottenbox-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $work | Out-Null
  try {
    $label = if ($Version) { $Version } else { '(local build)' }
    Write-Host "Chrome: downloading Rottenbox $label..."
    $zip = Join-Path $work 'chrome.zip'
    Invoke-WebRequest -UseBasicParsing -Uri (Get-AssetUrl 'rottenbox-chrome.zip') -OutFile $zip
    $unpacked = Join-Path $work 'chrome'
    Expand-Archive -Path $zip -DestinationPath $unpacked
    if (-not (Test-Path (Join-Path $unpacked 'manifest.json'))) {
      throw "the download doesn't look like an extension (no manifest.json)"
    }
    Set-Content -Path (Join-Path $unpacked '.version') -Value $Version -NoNewline

    # same path every time: Chrome derives an unpacked extension's id (and so its saved settings) from it
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    if (Test-Path $ChromeDir) { Remove-Item -Recurse -Force $ChromeDir }
    Move-Item $unpacked $ChromeDir
  } finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  }

  if (-not $current) {
    Write-Host ''
    Write-Host 'Rottenbox is unpacked at:'
    Write-Host "  $ChromeDir"
    Write-Host ''
    Write-Host 'Chrome only installs Web Store extensions directly, so load it once by hand:'
    Write-Host '  1. Open chrome://extensions'
    Write-Host '  2. Turn on Developer mode (top right)'
    Write-Host '  3. Click Load unpacked and choose the folder above'
    Write-Host ''
    Write-Host 'Re-run this script to update.'
    $exe = Find-Chrome
    if ($exe -and -not $env:ROTTENBOX_NO_OPEN) { try { Start-Process $exe 'chrome://extensions' } catch {} }
  } else {
    $label = if ($Version) { $Version } else { 'the local build' }
    Write-Host "Chrome: updated to $label. Click the reload icon on Rottenbox in chrome://extensions, or restart Chrome."
  }
}

function Install-Firefox {
  $url = Get-AssetUrl 'rottenbox-firefox.xpi'
  $exe = if ($env:ROTTENBOX_NO_OPEN) { $null } else { Find-Firefox } # headless / tests: just print
  if ($exe) {
    Start-Process $exe $url
    Write-Host 'Firefox: opened the installer. Accept the prompt; Firefox keeps Rottenbox updated from then on.'
  } else {
    Write-Host 'Firefox: open this link in Firefox to install (it updates itself afterwards):'
    Write-Host "  $url"
  }
}

# --- main --------------------------------------------------------------------

switch ($Browser) {
  'chrome' { Install-Chrome }
  'firefox' { Install-Firefox }
  default {
    $found = $false
    if (Find-Chrome) { Install-Chrome; $found = $true }
    if (Find-Firefox) { Install-Firefox; $found = $true }
    if (-not $found) { Install-Chrome }
  }
}
