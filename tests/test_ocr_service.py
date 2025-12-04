"""
Unit tests for OCR Service
Tests text extraction from images using Tesseract OCR
"""

import pytest
import os
import sys
from PIL import Image, ImageDraw, ImageFont
import tempfile

# Add parent directory to path to import services
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ocr-service'))

# Try to import OCR service, skip tests if dependencies not available
try:
    from main import app
    from fastapi.testclient import TestClient
    client = TestClient(app)
    OCR_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    # OCR service dependencies not available in test environment
    OCR_AVAILABLE = False
    client = None


def create_test_image_with_text(text: str) -> str:
    """Create a temporary image file with text for testing"""
    # Create a simple image with text
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        font = ImageFont.load_default()
    
    draw.text((10, 10), text, fill='black', font=font)
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
    img.save(temp_file.name)
    temp_file.close()
    
    return temp_file.name


@pytest.mark.skipif(not OCR_AVAILABLE, reason="OCR service dependencies (pytesseract) not available in test environment")
class TestOCRService:
    """Test suite for OCR Service"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        # Check for service name or status
        assert "service" in data or "status" in data
    


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
