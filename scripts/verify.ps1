# Unified verify for EduInsight (backend + frontend)
# Usage:
#   .\scripts\verify.ps1           # full verify
#   .\scripts\verify.ps1 -Quick    # lint only
#   .\scripts\verify.ps1 -AgentEval  # include slow LLM agent evaluation

param(
    [switch]$Quick,
    [switch]$AgentEval
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-Step {
    param([string]$Name, [scriptblock]$Action)
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Push-Location $Root
try {
    Invoke-Step "Backend lint (ruff)" {
        Push-Location backend
        try { ruff check app tests } finally { Pop-Location }
    }

    if (-not $Quick) {
        Invoke-Step "Backend tests (pytest + coverage)" {
            Push-Location backend
            try { pytest -q -m "not slow and not eval" } finally { Pop-Location }
        }
    }

    Invoke-Step "Frontend lint" {
        npm run lint --prefix frontend
    }

    if (-not $Quick) {
        Invoke-Step "Frontend tests (vitest)" {
            npm test --prefix frontend
        }
    }

    if ($AgentEval) {
        Invoke-Step "Agent evaluation (run_evaluation.py)" {
            Push-Location backend
            try {
                if (Test-Path "scripts/run_evaluation.py") {
                    python scripts/run_evaluation.py
                } else {
                    Write-Warning "backend/scripts/run_evaluation.py not found; skipping agent eval"
                }
            } finally { Pop-Location }
        }
    }

    Write-Host "`nAll verify steps passed." -ForegroundColor Green
} finally {
    Pop-Location
}
