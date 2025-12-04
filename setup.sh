#!/bin/bash

# Setup script for AI Context-Aware Study Coach
# This script helps initialize the project

echo "🚀 Setting up AI Context-Aware Study Coach..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Start Docker services
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if Ollama is running
echo "🔍 Checking Ollama service..."
if docker ps | grep -q "study-coach-ollama"; then
    echo "✅ Ollama container is running"
    
    # Pull the model if not already present
    echo "📥 Pulling Ollama model (llama3.2:1b)..."
    docker exec study-coach-ollama ollama pull llama3.2:1b
    
    echo "✅ Model pulled successfully"
else
    echo "❌ Ollama container is not running. Please check docker-compose logs."
fi

# Check if backend is running
echo "🔍 Checking backend service..."
if docker ps | grep -q "study-coach-backend"; then
    echo "✅ Backend container is running"
    
    # Test backend health
    sleep 5
    if curl -s http://localhost:8000/ > /dev/null; then
        echo "✅ Backend API is responding"
    else
        echo "⚠️  Backend API is not responding yet. It may still be starting up."
    fi
else
    echo "❌ Backend container is not running. Please check docker-compose logs."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Install mobile app dependencies: cd mobile-app && npm install"
echo "2. Start mobile app: cd mobile-app && npm start"
echo "3. Test backend API: curl http://localhost:8000/"
echo "4. Run tests: pytest tests/test_backend.py -v"
echo ""
echo "For more information, see README.md"

