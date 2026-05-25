# Validate-Release.ps1
# Automates the validation process for the OIDC Identity Provider
# - Runs Unit Tests
# - Runs E2E Tests (Headless)
# - Performs Production Build
# - Verifies Artifacts

$ErrorActionPreference = "Stop"

function Write-Step {
    param($Message)
    Write-Host "👉 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    exit 1
}

# 1. Unit Tests
Write-Step "Running Unit Tests..."
try {
    pnpm run test -- --run
    Write-Success "Unit Tests Passed"
} catch {
    Write-ErrorMsg "Unit Tests Failed. Check output above."
}

# 2. Build
Write-Step "Building for Production..."
try {
    pnpm run build
    if (!(Test-Path "dist/index.html")) { throw "dist/index.html not found" }
    Write-Success "Build Successful. Artifacts generated in /dist"
} catch {
    Write-ErrorMsg "Build Failed. Check output above."
}

# 3. E2E Tests
Write-Step "Running E2E Tests (Playwright)..."
try {
    # Ensure browsers are installed
    # pnpm exec playwright install --with-deps # Uncomment if running in a fresh CI env
    pnpm exec playwright test
    Write-Success "E2E Tests Passed"
} catch {
    Write-ErrorMsg "E2E Tests Failed. Check report."
}

Write-Host "`n🚀 ALL CHECKS PASSED. SYSTEM IS READY FOR RELEASE." -ForegroundColor Magenta
