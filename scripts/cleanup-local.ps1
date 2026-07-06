[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$AllPlaywrightDaemons,
  [switch]$RemoveArtifacts
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$playwrightArtifacts = Join-Path $workspaceRoot ".playwright-cli"

function Get-ProcessTable {
  Get-CimInstance Win32_Process |
    Where-Object { $_.Name -in @("node.exe", "cmd.exe", "powershell.exe", "pwsh.exe") } |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine
}

function Test-IsSeatWiseProcess {
  param(
    [Parameter(Mandatory = $true)]
    $Process
  )

  $commandLine = [string]$Process.CommandLine
  if ([string]::IsNullOrWhiteSpace($commandLine)) {
    return $false
  }

  $normalizedCommand = $commandLine.ToLowerInvariant()
  $normalizedRoot = $workspaceRoot.ToLowerInvariant()

  if ($normalizedCommand.Contains("\openai\codex\runtimes\")) {
    return $false
  }

  if ($normalizedCommand -match "playwright-core[\\/]+lib[\\/]+entry[\\/]+clidaemon\.js" -and
      ($AllPlaywrightDaemons -or $normalizedCommand -match "seatwise")) {
    return $true
  }

  if ($normalizedCommand.Contains($normalizedRoot) -and
      $normalizedCommand -match "(next[\\/]+dist[\\/]+bin[\\/]+next|eslint[\\/]+bin[\\/]+eslint|vitest[\\/]+vitest\.mjs)") {
    return $true
  }

  return $false
}

$processes = @(Get-ProcessTable)
$rootTargets = @($processes | Where-Object { Test-IsSeatWiseProcess $_ })

if ($rootTargets.Count -eq 0) {
  Write-Host "No SeatWise local process leftovers found."
} else {
  foreach ($target in $rootTargets | Sort-Object ProcessId -Unique) {
    $targetId = [int]$target.ProcessId
    $label = "$($target.Name) PID $targetId"
    if ($PSCmdlet.ShouldProcess($label, "Stop process tree")) {
      & "$env:SystemRoot\System32\taskkill.exe" /PID $targetId /T /F | Out-Null
      Write-Host "Stopped $label"
    }
  }
}

if ($RemoveArtifacts -and (Test-Path -LiteralPath $playwrightArtifacts)) {
  $resolvedArtifacts = (Resolve-Path -LiteralPath $playwrightArtifacts).Path
  if (-not $resolvedArtifacts.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the workspace: $resolvedArtifacts"
  }

  if ($PSCmdlet.ShouldProcess($resolvedArtifacts, "Remove local Playwright CLI artifacts")) {
    Remove-Item -LiteralPath $resolvedArtifacts -Recurse -Force
    Write-Host "Removed $resolvedArtifacts"
  }
}
