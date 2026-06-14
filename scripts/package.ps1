$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$staging = Join-Path $dist "the-forever-winter"
$zipPath = Join-Path $dist "the-forever-winter-vortex-extension-0.0.1.zip"

if (Test-Path $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "src") | Out-Null

Copy-Item -LiteralPath (Join-Path $root "index.js") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "info.json") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "gameart.jpg") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "README.md") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "CHANGELOG.md") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "LICENSE") -Destination $staging
Copy-Item -LiteralPath (Join-Path $root "src\constants.js") -Destination (Join-Path $staging "src")
Copy-Item -LiteralPath (Join-Path $root "src\installers.js") -Destination (Join-Path $staging "src")
Copy-Item -LiteralPath (Join-Path $root "src\setup.js") -Destination (Join-Path $staging "src")

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Host "Wrote $zipPath"
