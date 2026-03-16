[CmdletBinding()]
param(
  [switch]$RunImmediately
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptsDir = (Resolve-Path $PSScriptRoot).Path
$StartScript = Join-Path $ScriptsDir "start-company-ai.ps1"
$WatchdogScript = Join-Path $ScriptsDir "watchdog-company-ai.ps1"
$WatchdogLoopScript = Join-Path $ScriptsDir "watchdog-loop-company-ai.ps1"
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartShortcutPath = Join-Path $StartupDir "Company AI - Start Stack.cmd"
$WatchdogShortcutPath = Join-Path $StartupDir "Company AI - Watchdog.cmd"

$startAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -Build"
$watchdogAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`""

$startTrigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Highest

function Install-StartupFallback {
  $startCommand = "@echo off`r`nstart `"`" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`" -Build`r`n"
  $watchdogCommand = "@echo off`r`nstart `"`" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$WatchdogLoopScript`"`r`n"

  Set-Content -Path $StartShortcutPath -Value $startCommand -Encoding ASCII
  Set-Content -Path $WatchdogShortcutPath -Value $watchdogCommand -Encoding ASCII
}

$installMode = "scheduled-task"
try {
  Register-ScheduledTask -TaskName "Company AI - Start Stack" -Action $startAction -Trigger $startTrigger -Settings $settings -Principal $principal -Force | Out-Null
  Register-ScheduledTask -TaskName "Company AI - Watchdog" -Action $watchdogAction -Trigger $watchdogTrigger -Settings $settings -Principal $principal -Force | Out-Null
} catch {
  $installMode = "startup-folder"
  Unregister-ScheduledTask -TaskName "Company AI - Start Stack" -Confirm:$false -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName "Company AI - Watchdog" -Confirm:$false -ErrorAction SilentlyContinue
  Install-StartupFallback
}

if ($RunImmediately) {
  if ($installMode -eq "scheduled-task") {
    Start-ScheduledTask -TaskName "Company AI - Start Stack"
  } else {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $StartScript, "-Build" | Out-Null
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $WatchdogLoopScript | Out-Null
  }
}
