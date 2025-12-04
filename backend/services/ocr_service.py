"""
OCR Service for extracting text from images
Uses Tesseract OCR for text extraction from camera scans
"""

import pytesseract
from PIL import Image
import logging
import os

logger = logging.getLogger(__name__)


class OCRService:
    """Service for Optical Character Recognition from images"""
    
    def __init__(self):
        """Initialize OCR service with Tesseract configuration"""
        # Configure Tesseract path if needed (for Windows/Docker)
        if os.getenv("TESSERACT_CMD"):
            pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")
        
        logger.info("OCR Service initialized")
    
    async def extract_text(self, image_path: str) -> str:
        """
        Extract text from an image file
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Extracted text as string
        """
        try:
            logger.info(f"Extracting text from image: {image_path}")
            
            # Open and process image
            image = Image.open(image_path)
            
            # Perform OCR
            extracted_text = pytesseract.image_to_string(image)
            
            # Clean up text
            extracted_text = extracted_text.strip()
            
            if not extracted_text:
                logger.warning("No text extracted from image")
                return "No text could be extracted from the image. Please ensure the image is clear and contains readable text."
            
            logger.info(f"Successfully extracted {len(extracted_text)} characters")
            return extracted_text
        
        except Exception as e:
            logger.error(f"Error in OCR extraction: {str(e)}")
            raise Exception(f"Failed to extract text from image: {str(e)}")

