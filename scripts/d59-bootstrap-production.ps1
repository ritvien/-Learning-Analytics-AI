# D59 — Bootstrap production data from local machine (Render Free has no Shell).
# Usage:
#   .\scripts\d59-bootstrap-production.ps1 `
#     -BaseUrl "https://eduinsight-fe.vercel.app" `
#     -AdminEmail "admin@epu.edu.vn" `
#     -AdminPassword "123456"
#
# Optional CTĐT RAG ingest (requires External AGENT_DB_URL + OPENAI_API_KEY):
#   .\scripts\d59-bootstrap-production.ps1 -BaseUrl "..." -IngestCtdt -AgentDbUrl "postgresql://..."

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$AdminEmail = "admin@epu.edu.vn",
    [string]$AdminPassword = "123456",

    [switch]$SkipEtl,
    [switch]$SkipMl,
    [switch]$IngestCtdt,
    [string]$AgentDbUrl = $env:AGENT_DB_URL,
    [string]$CtdtJsonl = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host "==> D59 bootstrap against $BaseUrl"

$loginBody = @{
    username = $AdminEmail
    password = $AdminPassword
}
$login = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/v1/auth/login" `
    -Body $loginBody `
    -ContentType "application/x-www-form-urlencoded"
$headers = @{ Authorization = "Bearer $($login.access_token)" }
Write-Host "    Login OK ($AdminEmail)"

if (-not $SkipEtl) {
    Write-Host "==> DWH refresh..."
    $etl = Invoke-RestMethod -Method POST `
        -Uri "$BaseUrl/api/v1/admin/dwh/refresh" `
        -Headers $headers
    Write-Host "    ETL run id: $($etl.etl_run_id)"
}

if (-not $SkipMl) {
    Write-Host "==> ML train (dropout)..."
    $train = Invoke-RestMethod -Method POST `
        -Uri "$BaseUrl/api/v1/admin/ml/train?model=dropout" `
        -Headers $headers
    Write-Host "    model_run_id: $($train.model_run_id)"

    Write-Host "==> ML score-dropout..."
    $score = Invoke-RestMethod -Method POST `
        -Uri "$BaseUrl/api/v1/admin/ml/score-dropout?model_run_id=$($train.model_run_id)" `
        -Headers $headers
    Write-Host "    rows_upserted: $($score.rows_upserted)"
}

if ($IngestCtdt) {
    if (-not $AgentDbUrl) {
        Write-Error "IngestCtdt requires -AgentDbUrl or env AGENT_DB_URL (Render External DB URL, sync postgresql://)."
    }
    if (-not $env:OPENAI_API_KEY -and -not $env:LLM_API_KEY) {
        Write-Error "IngestCtdt requires OPENAI_API_KEY or LLM_API_KEY."
    }
    $jsonl = $CtdtJsonl
    if (-not $jsonl) {
        $jsonl = Join-Path $Root "docs\20-RAG-Corpus-Preparation\ctdt\ctdt_chunks.jsonl"
    }
    if (-not (Test-Path $jsonl)) {
        Write-Error "CTĐT jsonl not found: $jsonl"
    }
    Write-Host "==> CTĐT RAG ingest from $jsonl ..."
    $env:AGENT_DB_URL = $AgentDbUrl
    Push-Location (Join-Path $Root "backend")
    try {
        python scripts/ingest_ctdt_rag.py --input $jsonl
        if ($LASTEXITCODE -ne 0) { throw "ingest_ctdt_rag.py failed" }
    } finally {
        Pop-Location
    }
}

Write-Host "==> D59 bootstrap complete."
