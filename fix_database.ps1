# Studio Maestro Database Reset and Schema Push
# Runs the nuclear option cleanly

$ErrorActionPreference = "Stop"

Write-Host "=== Studio Maestro Database Reset ===" -ForegroundColor Cyan
Write-Host ""

# Set password environment variable
$env:PGPASSWORD = "M4estro_Secure_2026!#"

Write-Host "Step 1: Dropping and recreating public schema..." -ForegroundColor Yellow

# Find psql.exe
$psqlPaths = @(
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "psql.exe"  # Try PATH
)

$psqlExe = $null
foreach ($path in $psqlPaths) {
    if (Test-Path $path -ErrorAction SilentlyContinue) {
        $psqlExe = $path
        break
    }
    if ($path -eq "psql.exe") {
        try {
            $null = Get-Command psql -ErrorAction Stop
            $psqlExe = "psql"
            break
        } catch {}
    }
}

if (-not $psqlExe) {
    Write-Host "ERROR: Could not find psql.exe" -ForegroundColor Red
    Write-Host "Please install PostgreSQL or add it to PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Using psql: $psqlExe" -ForegroundColor Gray

# Run the reset script
& $psqlExe -U studio_user -d studio_maestro -f "C:\Projects\Studio_Maestro\reset_db.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database reset failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Schema reset complete" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Pushing new schema from Drizzle..." -ForegroundColor Yellow
npm run db:push

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Schema push failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== SUCCESS ===" -ForegroundColor Green
Write-Host "Database schema has been reset and updated" -ForegroundColor Green
Write-Host "All tables recreated with production-grade structure" -ForegroundColor Green
