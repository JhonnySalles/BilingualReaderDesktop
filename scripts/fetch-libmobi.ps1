# Fetches libmobi sources into native/libmobi-addon/vendor/libmobi (LGPL).
# Requires git. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File ./scripts/fetch-libmobi.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Vendor = Join-Path $Root "native\libmobi-addon\vendor"
$Dest = Join-Path $Vendor "libmobi"

New-Item -ItemType Directory -Force -Path $Vendor | Out-Null

if (Test-Path (Join-Path $Dest "src\mobi.h")) {
  Write-Host "libmobi already present at $Dest"
  exit 0
}

if (Test-Path $Dest) {
  Remove-Item -Recurse -Force $Dest
}

Write-Host "Cloning libmobi (shallow)..."
git clone --depth 1 https://github.com/bfabiszewski/libmobi.git $Dest
Write-Host "Done. Next: yarn build:native"
