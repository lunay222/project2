# Setup script for AI Context-Aware Study Coach (PowerShell)
# This script helps initialize the project on Windows

Write-Host "🚀 Setting up AI Context-Aware Study Coach..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Start Docker services
Write-Host "📦 Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if Ollama is running
Write-Host "🔍 Checking Ollama service..." -ForegroundColor Yellow
$ollamaRunning = docker ps | Select-String "study-coach-ollama"
if ($ollamaRunning) {
    Write-Host "✅ Ollama container is running" -ForegroundColor Green
    
    # Pull the model if not already present
    Write-Host "📥 Pulling Ollama model (llama3.2:1b)..." -ForegroundColor Yellow
    docker exec study-coach-ollama ollama pull llama3.2:1b
    
    Write-Host "✅ Model pulled successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Ollama container is not running. Please check docker-compose logs." -ForegroundColor Red
}

# Check if backend is running
Write-Host "🔍 Checking backend service..." -ForegroundColor Yellow
$backendRunning = docker ps | Select-String "study-coach-backend"
if ($backendRunning) {
    Write-Host "✅ Backend container is running" -ForegroundColor Green
    
    # Test backend health
    Start-Sleep -Seconds 5
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing -TimeoutSec 5
        Write-Host "✅ Backend API is responding" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Backend API is not responding yet. It may still be starting up." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Backend container is not running. Please check docker-compose logs." -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Install mobile app dependencies: cd mobile-app; npm install"
Write-Host "2. Start mobile app: cd mobile-app; npm start"
Write-Host "3. Test backend API: Invoke-WebRequest http://localhost:8000/"
Write-Host "4. Run tests: pytest tests/test_backend.py -v"
Write-Host ""
Write-Host "For more information, see README.md"

