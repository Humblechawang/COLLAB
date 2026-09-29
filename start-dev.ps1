# start-dev.ps1 — API + static frontend (Supabase is the database)
# Fill backend/.env from the Supabase dashboard first.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$envFile = Join-Path $root "backend\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"'), 'Process')
        }
    }
}
$configExample = Join-Path $root "frontend\config.example.js"
$configLocal = Join-Path $root "frontend\config.js"
if ((Test-Path $configExample) -and -not (Test-Path $configLocal)) {
    Copy-Item $configExample $configLocal
}

Write-Host "Frontend  http://localhost:8080"
Write-Host "API       http://localhost:4000"
Write-Host "Set SUPABASE_URL, DATABASE_URL (pooler), DATABASE_MIGRATE_URL (direct) in backend/.env"
Write-Host "Then: npm --prefix backend run migrate"

$backendJob = Start-Job -ScriptBlock {
    Set-Location "$using:root\backend"
    node --watch src/server.js 2>&1
}
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:root"
    npx -y http-server frontend -p 8080 --cors -c-1 2>&1
}

try {
    while ($true) {
        Receive-Job $backendJob  | ForEach-Object { Write-Host "[backend]  $_" -ForegroundColor Blue }
        Receive-Job $frontendJob | ForEach-Object { Write-Host "[frontend] $_" -ForegroundColor Magenta }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
}
