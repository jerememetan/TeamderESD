$ErrorActionPreference = "Stop"

function Add-Violation {
  param(
    [System.Collections.Generic.List[string]]$Violations,
    [string]$Message
  )

  $Violations.Add($Message) | Out-Null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$violations = New-Object "System.Collections.Generic.List[string]"

# 1) Cycle-era swap routes must not appear in active app code.
$activeCodeRoots = @(
  (Join-Path $repoRoot "composite-services"),
  (Join-Path $repoRoot "..\frontend\src")
)

foreach ($root in $activeCodeRoots) {
  if (-not (Test-Path $root)) { continue }

  $files = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Extension -in @('.py', '.js', '.jsx', '.ts', '.tsx') -and
      $_.Name -ne 'swagger_helper.py'
    }

  $hits = $files | ForEach-Object {
    Select-String -Path $_.FullName -Pattern "/swap-orchestrator/cycles|/cycles/" -AllMatches -ErrorAction SilentlyContinue
  }
  foreach ($hit in $hits) {
    Add-Violation $violations "Cycle-era swap route reference found: $($hit.Path):$($hit.LineNumber)"
  }
}

# 2) Instructor courses stage mapping must include full stage model.
$formationFlowPath = Join-Path $repoRoot "..\frontend\src\pages\instructor\logic\formationFlow.js"
$stageConfigPath = Join-Path $repoRoot "..\frontend\src\pages\instructor\Courses\logic\stageConfig.js"
$swapOrchestratorPath = Join-Path $repoRoot "composite-services\swap-orchestrator\app.py"

if (Test-Path $formationFlowPath) {
  $formationFlowText = Get-Content -Path $formationFlowPath -Raw
  $requiredFlowTokens = @(
    'SETUP: "setup"',
    'COLLECTING: "collecting"',
    'FORMING: "forming"',
    'FORMED: "formed"',
    'CONFIRMED: "confirmed"',
    'COMPLETED: "completed"'
  )

  foreach ($token in $requiredFlowTokens) {
    if ($formationFlowText -notmatch [regex]::Escape($token)) {
      Add-Violation $violations "Missing stage mapping token in formationFlow.js: $token"
    }
  }
} else {
  Add-Violation $violations "Missing required file: $formationFlowPath"
}

if (Test-Path $stageConfigPath) {
  $stageConfigText = Get-Content -Path $stageConfigPath -Raw
  $requiredConfigKeys = @("setup", "collecting", "forming", "formed", "confirmed", "completed")
  foreach ($key in $requiredConfigKeys) {
    if ($stageConfigText -notmatch "(?m)^\s*$key\s*:\s*\{") {
      Add-Violation $violations "Missing stage config key in stageConfig.js: $key"
    }
  }
} else {
  Add-Violation $violations "Missing required file: $stageConfigPath"
}

# 3) Swap policy enforcement must match architecture diagrams.
if (Test-Path $swapOrchestratorPath) {
  $swapOrchestratorText = Get-Content -Path $swapOrchestratorPath -Raw

  if ($swapOrchestratorText -notmatch 'section_stage\s+in\s+\{"confirmed",\s*"completed"\}') {
    Add-Violation $violations "Missing no-appeal guard for confirmed/completed stages in swap-orchestrator decision flow"
  }

  if ($swapOrchestratorText -notmatch 'if\s+stage\s*!=\s*"formed"') {
    Add-Violation $violations "Missing formed-only confirm guard in swap-orchestrator confirm flow"
  }
} else {
  Add-Violation $violations "Missing required file: $swapOrchestratorPath"
}

if ($violations.Count -gt 0) {
  Write-Host "Architecture guardrails check FAILED:" -ForegroundColor Red
  foreach ($item in $violations) {
    Write-Host "- $item" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Architecture guardrails check PASSED." -ForegroundColor Green
exit 0
