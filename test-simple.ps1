# Simple API test - one request at a time
Write-Host "Testing health endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
    Write-Host "✓ Health check passed" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 1

Write-Host "`nTesting GET /orders..." -ForegroundColor Cyan
try {
    $orders = Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method GET
    Write-Host "✓ GET /orders successful - Found $($orders.Count) orders" -ForegroundColor Green
} catch {
    Write-Host "✗ GET /orders failed: $_" -ForegroundColor Red
}
