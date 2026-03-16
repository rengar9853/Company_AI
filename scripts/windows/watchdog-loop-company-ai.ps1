[CmdletBinding()]
param(
  [int]$IntervalMinutes = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$WatchdogScript = Join-Path $PSScriptRoot "watchdog-company-ai.ps1"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-LoopLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path (Join-Path $LogDir "windows-watchdog-loop.log") -Value "[$timestamp] $Message"
}

while ($true) {
  try {
    & $WatchdogScript
  } catch {
    Write-LoopLog $_.Exception.Message
  }

  Start-Sleep -Seconds ($IntervalMinutes * 60)
}
