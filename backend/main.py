"""
AI Context-Aware Study Coach - Backend API
Main FastAPI application for handling OCR, audio processing, and AI generation
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os
from typing import Optional
import logging

from services.ocr_service import OCRService
from services.audio_service import AudioService
from services.ai_service import AIService
from services.tts_service import TTSService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Study Coach API",
    description="AI-powered study coach for generating flashcards, summaries, and questions",
    version="1.0.0"
)

# CORS middleware for mobile app communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ocr_service = OCRService()
audio_service = AudioService()
ai_service = AIService()
tts_service = TTSService()


# Pydantic models for request validation
class GenerateContentRequest(BaseModel):
    text: str
    content_type: str = "all"


class TextToSpeechRequest(BaseModel):
    text: str


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Study Coach API is running", "status": "healthy"}


@app.post("/api/scan-notes")
async def scan_notes(file: UploadFile = File(...)):
    """
    Process image from camera and extract text using OCR
    Returns extracted text for AI processing
    """
    try:
        logger.info(f"Received image file: {file.filename}")
        
        # Save uploaded file temporarily
        import tempfile
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, file.filename or "uploaded_image.jpg")
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Extract text using OCR
        extracted_text = await ocr_service.extract_text(file_path)
        
        # Clean up temporary file
        os.remove(file_path)
        
        return JSONResponse({
            "success": True,
            "text": extracted_text,
            "message": "Text extracted successfully"
        })
    
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """
    Process audio recording from microphone
    Transcribes audio to text for AI processing
    """
    try:
        logger.info(f"Received audio file: {file.filename}")
        
        # Save uploaded file temporarily
        import tempfile
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, file.filename or "uploaded_image.jpg")
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Transcribe audio to text
        transcribed_text = await audio_service.transcribe_audio(file_path)
        
        # Clean up temporary file
        os.remove(file_path)
        
        return JSONResponse({
            "success": True,
            "text": transcribed_text,
            "message": "Audio transcribed successfully"
        })
    
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")


@app.post("/api/generate-content")
async def generate_content(request: GenerateContentRequest):
    """
    Generate flashcards, summaries, and questions from extracted text
    content_type: "flashcards", "summary", "questions", or "all"
    """
    try:
        logger.info(f"Received generate-content request: text length={len(request.text)}, content_type={request.content_type}")
        text = request.text
        content_type = request.content_type
        
        logger.info(f"Generating {content_type} for text of length {len(text)}")
        
        if not text or len(text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text input is required")
        
        result = {}
        
        if content_type in ["flashcards", "all"]:
            flashcards = await ai_service.generate_flashcards(text)
            result["flashcards"] = flashcards
        
        if content_type in ["summary", "all"]:
            summary = await ai_service.generate_summary(text)
            result["summary"] = summary
        
        if content_type in ["questions", "all"]:
            questions = await ai_service.generate_questions(text)
            result["questions"] = questions
        
        return JSONResponse({
            "success": True,
            "content": result,
            "message": f"Content generated successfully"
        })
    
    except Exception as e:
        logger.error(f"Error generating content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")


@app.post("/api/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    """
    Convert text to speech audio for reading questions aloud
    Returns audio file URL or base64 encoded audio
    """
    try:
        text = request.text
        logger.info(f"Converting text to speech: {text[:50]}...")
        
        audio_data = await tts_service.synthesize_speech(text)
        
        return JSONResponse({
            "success": True,
            "audio": audio_data,
            "message": "Speech synthesized successfully"
        })
    
    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in text-to-speech: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

