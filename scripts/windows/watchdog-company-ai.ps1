[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
$LogDir = Join-Path $ProjectRoot "logs"
$StartScript = Join-Path $PSScriptRoot "start-company-ai.ps1"
$WebPort = if ($env:COMPANY_AI_WEB_PORT) { [int]$env:COMPANY_AI_WEB_PORT } else { 8080 }

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -Path (Join-Path $LogDir "windows-watchdog.log") -Value $line
}

function Test-DockerEngine {
  try {
    docker version --format "{{.Server.Version}}" | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Test-HttpOk {
  param([string]$Uri)

  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

if (-not (Test-DockerEngine)) {
  Write-Log "Docker engine is unavailable. Running startup recovery."
  & $StartScript
  exit 0
}

$composeStatus = @()
try {
  $composeStatus = @(
    docker compose -f $ComposeFile ps --format json |
      Where-Object { $_.Trim() } |
      ForEach-Object { $_ | ConvertFrom-Json }
  )
} catch {
  Write-Log "Unable to read compose status. Re-running startup."
  & $StartScript
  exit 0
}

$requiredServices = @("mysql", "redis", "backend", "frontend", "nginx")
$runningServices = @($composeStatus | Where-Object { $_.State -eq "running" } | ForEach-Object { $_.Service })
$missingServices = @($requiredServices | Where-Object { $_ -notin $runningServices })

if ($missingServices.Count -gt 0) {
  Write-Log "Detected stopped services: $($missingServices -join ', '). Re-running startup."
  & $StartScript
  exit 0
}

$healthChecks = @(
  "http://127.0.0.1:3001/health",
  "http://127.0.0.1:3001/mcp/health",
  "http://127.0.0.1:$WebPort/"
)

$failedChecks = @($healthChecks | Where-Object { -not (Test-HttpOk -Uri $_) })
if ($failedChecks.Count -gt 0) {
  Write-Log "HTTP checks failed: $($failedChecks -join ', '). Restarting stack."
  docker compose -f $ComposeFile up -d --remove-orphans | Out-Null
  exit 0
}

Write-Log "Watchdog check passed."
