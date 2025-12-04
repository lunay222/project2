"""
OCR Microservice - Standalone service for text extraction from images
Uses Tesseract OCR for optical character recognition
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pytesseract
from PIL import Image
import logging
import os
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OCR Service",
    description="Microservice for extracting text from images using OCR",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Tesseract path if needed
if os.getenv("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"service": "OCR Service", "status": "healthy", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract text from an image file using OCR
    
    Args:
        file: Image file (JPEG, PNG, etc.)
        
    Returns:
        JSON response with extracted text
    """
    try:
        logger.info(f"Received image file: {file.filename}")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Open and process image
            image = Image.open(tmp_path)
            
            # Optimize image for OCR (resize if too large, convert to RGB)
            # This helps with processing speed and accuracy
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize very large images to speed up OCR (max 2000px on longest side)
            max_size = 2000
            width, height = image.size
            if width > max_size or height > max_size:
                if width > height:
                    new_width = max_size
                    new_height = int(height * (max_size / width))
                else:
                    new_height = max_size
                    new_width = int(width * (max_size / height))
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
            
            # Perform OCR with optimized settings
            # Use page segmentation mode 6 (assume uniform block of text) for better speed
            extracted_text = pytesseract.image_to_string(
                image,
                config='--psm 6'
            )
            
            # Clean up text
            extracted_text = extracted_text.strip()
            
            if not extracted_text:
                logger.warning("No text extracted from image")
                extracted_text = "No text could be extracted from the image. Please ensure the image is clear and contains readable text."
            
            logger.info(f"Successfully extracted {len(extracted_text)} characters")
            
            return JSONResponse({
                "success": True,
                "text": extracted_text,
                "message": "Text extracted successfully"
            })
        
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        logger.error(f"Error in OCR extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

