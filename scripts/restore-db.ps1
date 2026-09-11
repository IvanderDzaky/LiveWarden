param([Parameter(Mandatory=$true)][string]$Input)
$ErrorActionPreference = "Stop"
pg_restore --clean --if-exists --no-owner --dbname=$env:DATABASE_URL $Input
Write-Output "Restore completed: $Input"
