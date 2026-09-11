param(
  [string]$Output = "backups\livewarden-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
)
$ErrorActionPreference = "Stop"
$parent = Split-Path -Parent $Output
if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
pg_dump $env:DATABASE_URL --format=custom --file=$Output
Write-Output "Backup written: $Output"
