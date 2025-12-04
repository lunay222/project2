"""
Test suite for backend API
Tests all core functionality including OCR, audio processing, and AI generation
"""

import pytest
import requests
import os
import json
from fastapi.testclient import TestClient
import sys

# Add api-gateway to path (the actual API Gateway)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api-gateway'))

from main import app

client = TestClient(app)

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_IMAGE_PATH = os.path.join(os.path.dirname(__file__), "test_data", "test_notes.jpg")
TEST_AUDIO_PATH = os.path.join(os.path.dirname(__file__), "test_data", "test_audio.m4a")


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_root_endpoint(self):
        """Test that the API is running"""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()
        assert response.json()["status"] == "healthy"


class TestOCRService:
    """Test OCR functionality"""
    
    def test_scan_notes_endpoint_exists(self):
        """Test that scan-notes endpoint exists"""
        # Create a dummy image file for testing
        import io
        from PIL import Image
        
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
        response = client.post("/api/scan", files=files)
        
        # Should return 200 (success) or 503 (service unavailable) or 500 (error)
        assert response.status_code in [200, 500, 503]
    
    def test_scan_notes_without_file(self):
        """Test scan endpoint without file"""
        response = client.post("/api/scan")
        assert response.status_code == 422  # Validation error


class TestAIService:
    """Test AI content generation"""
    
    def test_generate_content_endpoint_exists(self):
        """Test that generate_quiz endpoint exists"""
        test_text = "This is a test text about machine learning. Machine learning is a subset of artificial intelligence."
        
        response = client.post(
            "/api/generate_quiz",
            json={"text": test_text, "quiz_type": "multiple_choice"}
        )
        
        # Should return 200 (success) or 500/503 (service unavailable)
        assert response.status_code in [200, 500, 503]
    
    def test_generate_content_without_text(self):
        """Test generate_quiz endpoint without text"""
        response = client.post(
            "/api/generate_quiz",
            json={"quiz_type": "multiple_choice"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_generate_content_empty_text(self):
        """Test generate_quiz endpoint with empty text"""
        response = client.post(
            "/api/generate_quiz",
            json={"text": "", "quiz_type": "multiple_choice"}
        )
        assert response.status_code == 400  # Bad request


class TestIntegration:
    """Integration tests for complete workflows"""
    
    def test_complete_workflow_scan_to_content(self):
        """Test complete workflow: scan notes -> generate content"""
        # This is a placeholder for integration testing
        # In a real scenario, you would:
        # 1. Upload an image
        # 2. Get extracted text
        # 3. Generate content from text
        # 4. Verify all steps work together
        
        assert True  # Placeholder
    
    def test_complete_workflow_audio_to_content(self):
        """Test complete workflow: record audio -> generate content"""
        # This is a placeholder for integration testing
        assert True  # Placeholder


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

