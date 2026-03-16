[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskNames = @(
  "Company AI - Start Stack",
  "Company AI - Watchdog"
)

$startupDir = [Environment]::GetFolderPath("Startup")
$startupFiles = @(
  (Join-Path $startupDir "Company AI - Start Stack.cmd"),
  (Join-Path $startupDir "Company AI - Watchdog.cmd")
)

foreach ($taskName in $taskNames) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

foreach ($startupFile in $startupFiles) {
  Remove-Item -Path $startupFile -Force -ErrorAction SilentlyContinue
}
