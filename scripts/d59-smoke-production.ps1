# D59 — Production smoke (health + login). Extends T45 runbook for Live URL.
# Windows may block scripts (execution policy). Use:
#   powershell -ExecutionPolicy Bypass -File scripts\d59-smoke-production.ps1 -VercelUrl "..." -RenderUrl "..."
# Usage:
#   .\scripts\d59-smoke-production.ps1 `
#     -VercelUrl "https://eduinsight-fe.vercel.app" `
#     -RenderUrl "https://eduinsight-be.onrender.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$VercelUrl,

    [Parameter(Mandatory = $true)]
    [string]$RenderUrl,

    [string]$AdminEmail = "admin@epu.edu.vn",
    [string]$AdminPassword = "123456"
)

$ErrorActionPreference = "Stop"
$VercelUrl = $VercelUrl.TrimEnd("/")
$RenderUrl = $RenderUrl.TrimEnd("/")

function Test-HttpOk {
    param([string]$Url, [string]$Label)
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing
    if ($resp.StatusCode -ne 200) {
        throw "$Label returned $($resp.StatusCode)"
    }
    Write-Host "[OK] $Label - $($resp.StatusCode)"
}

Write-Host "==> D59 production smoke"
Test-HttpOk "$VercelUrl/api/v1/health" "Vercel proxy /api/v1/health"
Test-HttpOk "$RenderUrl/health" "Render /health"

$loginBody = @{
    username = $AdminEmail
    password = $AdminPassword
}
$login = Invoke-RestMethod -Method POST `
    -Uri "$VercelUrl/api/v1/auth/login" `
    -Body $loginBody `
    -ContentType "application/x-www-form-urlencoded"
if (-not $login.access_token) {
    $preview = if ($login) { ($login | ConvertTo-Json -Compress) } else { "(empty response)" }
    throw "Login failed - no access_token from Vercel proxy (response: $preview). Check Vercel BACKEND_URL and Render SEED_PASSWORD=123456."
}
Write-Host "[OK] Login $AdminEmail"

$me = Invoke-RestMethod -Uri "$VercelUrl/api/v1/auth/me" `
    -Headers @{ Authorization = "Bearer $($login.access_token)" }
Write-Host "[OK] /auth/me - role=$($me.role)"

Write-Host "==> Manual: open $VercelUrl/manager/analytics and $VercelUrl/chat"
Write-Host "==> D59 smoke passed (automated checks)."
