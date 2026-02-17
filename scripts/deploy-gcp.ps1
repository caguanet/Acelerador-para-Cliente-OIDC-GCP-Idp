# Deploy-GCP.ps1
# Automates deployment to Cloud Run

param(
    [string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$ServiceName = "oidc-provider"
)

if (-not $ProjectId) {
    Write-Error "Please provide a Project ID using -ProjectId"
    exit 1
}

Write-Host "🚀 Deploying to Google Cloud Run ($Region)..." -ForegroundColor Cyan

# 1. Build Container (using Cloud Build or local Docker if available, here assuming gcloud builds submit for simplicity in CI)
# Ideally we use `gcloud run deploy --source .` which handles build.

Write-Host "📦 Submitting build and deploying..."
gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars "VITE_ALLOWED_ORIGINS=*" 

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment Successful!" -ForegroundColor Green
    $url = gcloud run services describe $ServiceName --project $ProjectId --region $Region --format 'value(status.url)'
    Write-Host "🌍 Service URL: $url" -ForegroundColor Green
} else {
    Write-Error "❌ Deployment Failed."
    exit 1
}
