# Script to start Study Coach for phone access
# This script starts all services and helps you connect your phone

Write-Host "🚀 Starting Study Coach for Phone Access..." -ForegroundColor Green
Write-Host ""

# Step 1: Check Docker
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and run this script again." -ForegroundColor Yellow
    exit 1
}

# Step 2: Get local IP address
Write-Host ""
Write-Host "🔍 Finding your local IP address..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"
} | Select-Object IPAddress, InterfaceAlias

if ($ipAddresses) {
    Write-Host "Found IP addresses:" -ForegroundColor Cyan
    $ipAddresses | ForEach-Object {
        Write-Host "  - $($_.IPAddress) ($($_.InterfaceAlias))" -ForegroundColor Cyan
    }
    $mainIP = ($ipAddresses | Select-Object -First 1).IPAddress
    Write-Host ""
    Write-Host "📱 Using IP: $mainIP" -ForegroundColor Green
    Write-Host "   (Make sure your phone is on the same WiFi network!)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Could not automatically detect IP address" -ForegroundColor Yellow
    Write-Host "   Please find your IP with: ipconfig" -ForegroundColor Yellow
    $mainIP = Read-Host 'Enter your computer IP address'
}

# Step 3: Start Docker services
Write-Host ""
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker services" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker services started" -ForegroundColor Green

# Step 4: Wait for services to be ready
Write-Host ""
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 5: Check if Ollama model is available
Write-Host ""
Write-Host "🧠 Checking Ollama model..." -ForegroundColor Yellow
$modelCheck = docker exec study-coach-ollama ollama list 2>$null
if ($modelCheck -match "llama3.2:1b") {
    Write-Host "✅ llama3.2:1b model is available" -ForegroundColor Green
} else {
    Write-Host "📥 Pulling llama3.2:1b model (this may take a few minutes)..." -ForegroundColor Yellow
    docker exec study-coach-ollama ollama pull llama3.2:1b
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Model pulled successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Model pull may have failed, but continuing..." -ForegroundColor Yellow
    }
}

# Step 6: Test backend
Write-Host ""
Write-Host "🔍 Testing backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Backend is running and accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend may still be starting up..." -ForegroundColor Yellow
}

# Step 7: Update mobile app configuration
Write-Host ""
Write-Host "📝 Updating mobile app configuration..." -ForegroundColor Yellow

$apiFile = "mobile-app\services\api.js"
if (Test-Path $apiFile) {
    $content = Get-Content $apiFile -Raw
    $pattern1 = "http://192\.168\.\d+\.\d+:8000"
    $pattern2 = "http://localhost:8000"
    $replacement = "http://${mainIP}:8000"
    $content = $content -replace $pattern1, $replacement
    $content = $content -replace $pattern2, $replacement
    Set-Content $apiFile -Value $content
    Write-Host "✅ Updated mobile app API URL to: http://${mainIP}:8000" -ForegroundColor Green
}

$appFile = "mobile-app\App.js"
if (Test-Path $appFile) {
    $content = Get-Content $appFile -Raw
    if ($content -match "API_BASE_URL") {
        $pattern1 = "http://192\.168\.\d+\.\d+:8000"
        $pattern2 = "http://localhost:8000"
        $replacement = "http://${mainIP}:8000"
        $content = $content -replace $pattern1, $replacement
        $content = $content -replace $pattern2, $replacement
        Set-Content $appFile -Value $content
        Write-Host "✅ Updated App.js API URL" -ForegroundColor Green
    }
}

# Step 8: Instructions
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Install Expo Go on your phone:" -ForegroundColor White
Write-Host "   - iOS: https://apps.apple.com/app/expo-go/id982107779" -ForegroundColor Cyan
Write-Host "   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Make sure your phone is on the same WiFi network as this computer" -ForegroundColor White
Write-Host ""
Write-Host "3. Start the mobile app:" -ForegroundColor White
Write-Host "   cd mobile-app" -ForegroundColor Cyan
Write-Host "   npm install" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Scan the QR code with:" -ForegroundColor White
Write-Host "   - iOS: Camera app" -ForegroundColor Cyan
Write-Host "   - Android: Expo Go app" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Test backend from phone browser:" -ForegroundColor White
Write-Host "   Open: http://$mainIP:8000/" -ForegroundColor Cyan
Write-Host "   Should show API health message" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Backend URL: http://$mainIP:8000" -ForegroundColor Green
Write-Host ""
Write-Host "For detailed instructions, see: SETUP_AND_RUN.md" -ForegroundColor Yellow
Write-Host ""

