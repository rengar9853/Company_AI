[CmdletBinding()]
param(
  [switch]$Build,
  [int]$DockerWaitSeconds = 180,
  [int]$HealthWaitSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
$LogDir = Join-Path $ProjectRoot "logs"
$WebPort = if ($env:COMPANY_AI_WEB_PORT) { [int]$env:COMPANY_AI_WEB_PORT } else { 8080 }

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -Path (Join-Path $LogDir "windows-startup.log") -Value $line
}

function Get-DockerDesktopPath {
  $candidates = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    "C:\Program Files\Docker\Docker\resources\Docker Desktop.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Test-DockerEngine {
  try {
    docker version --format "{{.Server.Version}}" | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds,
    [string]$Description
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (& $Condition) {
      return $true
    }
    Start-Sleep -Seconds 3
  }

  throw "Timed out waiting for $Description."
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
  $dockerDesktop = Get-DockerDesktopPath
  if ($dockerDesktop) {
    Write-Log "Docker engine is not ready. Starting Docker Desktop."
    Start-Process -FilePath $dockerDesktop | Out-Null
  } else {
    throw "Docker Desktop executable was not found."
  }
}

$null = Wait-Until -Condition { Test-DockerEngine } -TimeoutSeconds $DockerWaitSeconds -Description "Docker engine"
Write-Log "Docker engine is ready."

$composeArgs = @("compose", "-f", $ComposeFile, "up", "-d")
if ($Build) {
  $composeArgs += "--build"
}

Write-Log "Starting Company AI stack."
docker @composeArgs | Out-Null

$null = Wait-Until -Condition { Test-HttpOk -Uri "http://127.0.0.1:3001/health" } -TimeoutSeconds $HealthWaitSeconds -Description "backend health endpoint"
$null = Wait-Until -Condition { Test-HttpOk -Uri "http://127.0.0.1:3001/mcp/health" } -TimeoutSeconds $HealthWaitSeconds -Description "MCP health endpoint"
$null = Wait-Until -Condition { Test-HttpOk -Uri "http://127.0.0.1:$WebPort/" } -TimeoutSeconds $HealthWaitSeconds -Description "nginx homepage"

Write-Log "Company AI stack is healthy."
