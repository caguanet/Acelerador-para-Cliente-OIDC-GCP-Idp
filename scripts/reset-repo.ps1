# Reset-Repo.ps1
# CAUTION: This script destroys the current git history and starts fresh.
# Usage: ./Reset-Repo.ps1 -Force

param(
    [switch]$Force
)

if (-not $Force) {
    Write-Warning "This script will delete the .git folder and re-initialize the repository."
    Write-Warning "All commit history will be LOST."
    $confirm = Read-Host "Are you sure you want to continue? (y/N)"
    if ($confirm -ne 'y') { exit }
}

Write-Host "🚧 Backing up current .git folder..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Rename-Item ".git" ".git.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
}

Write-Host "🧹 Initializing new Git repository..." -ForegroundColor Cyan
git init
git add .
git commit -m "Initial Release: White-Label OIDC Infrastructure"

Write-Host "✅ Repository Reset Complete." -ForegroundColor Green
Write-Host "Next Steps: Add remote and push force (if necessary)." -ForegroundColor Gray
