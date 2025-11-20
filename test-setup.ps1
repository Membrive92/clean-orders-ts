# Test Setup Script
# This script checks Docker, starts PostgreSQL, runs migrations, and executes factory tests

Write-Host "🚀 Starting Test Setup..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1️⃣  Checking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "   ✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker is not running" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop and run this script again" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL container exists
Write-Host ""
Write-Host "2️⃣  Checking PostgreSQL container..." -ForegroundColor Yellow
$containerExists = docker ps -a --filter "name=clean-orders-postgres" --format "{{.Names}}" | Select-String -Pattern "clean-orders-postgres"

if ($containerExists) {
    $containerRunning = docker ps --filter "name=clean-orders-postgres" --format "{{.Names}}" | Select-String -Pattern "clean-orders-postgres"
    
    if ($containerRunning) {
        Write-Host "   ✅ PostgreSQL container is running" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  PostgreSQL container exists but not running" -ForegroundColor Yellow
        Write-Host "   Starting container..." -ForegroundColor Yellow
        docker start clean-orders-postgres
        Start-Sleep -Seconds 3
        Write-Host "   ✅ Container started" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  PostgreSQL container not found" -ForegroundColor Yellow
    Write-Host "   Starting docker-compose..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 5
    Write-Host "   ✅ PostgreSQL container created and started" -ForegroundColor Green
}

# Wait for PostgreSQL to be ready
Write-Host ""
Write-Host "3️⃣  Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    try {
        docker exec clean-orders-postgres pg_isready -U postgres | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            Write-Host "   ✅ PostgreSQL is ready" -ForegroundColor Green
        }
    } catch {
        # Continue waiting
    }
    
    if (-not $ready) {
        $attempt++
        Write-Host "   Waiting... ($attempt/$maxAttempts)" -ForegroundColor Gray
        Start-Sleep -Seconds 1
    }
}

if (-not $ready) {
    Write-Host "   ❌ PostgreSQL did not become ready in time" -ForegroundColor Red
    exit 1
}

# Run migrations
Write-Host ""
Write-Host "4️⃣  Running database migrations..." -ForegroundColor Yellow
npm run migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  Migration may have already run or encountered an issue" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Migrations completed" -ForegroundColor Green
}

# Build the project
Write-Host ""
Write-Host "5️⃣  Building TypeScript project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Build completed" -ForegroundColor Green

# Run the factory tests
Write-Host ""
Write-Host "6️⃣  Running factory tests..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

node test-factories.js

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All tests completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Tests failed" -ForegroundColor Red
    exit 1
}
