"""
API Gateway / Orchestrator Service
Coordinates communication between OCR service, LLM service, and frontend
Handles the complete workflow: Image → OCR → Text → LLM → Quiz/Content → Frontend
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os
import requests
import httpx
import logging
from typing import Optional, List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Study Coach API Gateway",
    description="Orchestrator service for AI Study Coach - coordinates OCR and LLM services",
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

# Service URLs from environment variables
OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://ocr-service:8001")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://ollama:11434")
TTS_ENABLED = os.getenv("TTS_ENABLED", "true").lower() == "true"


# Pydantic models for request validation
class GenerateQuizRequest(BaseModel):
    text: str
    quiz_type: str = "all"  # "multiple_choice", "fill_blank", "short_answer", "all"


class SummaryRequest(BaseModel):
    text: str


class TextToSpeechRequest(BaseModel):
    text: str


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Study Coach API Gateway is running",
        "status": "healthy",
        "services": {
            "ocr": OCR_SERVICE_URL,
            "llm": LLM_SERVICE_URL
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    # Check service availability
    services_status = {}
    
    try:
        ocr_response = requests.get(f"{OCR_SERVICE_URL}/health", timeout=2)
        services_status["ocr"] = "healthy" if ocr_response.status_code == 200 else "unhealthy"
    except:
        services_status["ocr"] = "unreachable"
    
    try:
        ollama_response = requests.get(f"{LLM_SERVICE_URL}/api/tags", timeout=2)
        services_status["llm"] = "healthy" if ollama_response.status_code == 200 else "unhealthy"
    except:
        services_status["llm"] = "unreachable"
    
    return {"status": "healthy", "services": services_status}


@app.post("/api/scan")
async def scan_image(file: UploadFile = File(...)):
    """
    Orchestrates image scanning workflow:
    1. Receives image from frontend
    2. Sends to OCR service for text extraction
    3. Returns extracted text
    
    This is the entry point for the camera input → OCR → text pipeline
    """
    try:
        logger.info(f"Received image file: {file.filename}")
        
        # Forward image to OCR service
        # Use async httpx instead of blocking requests.post to prevent blocking the event loop
        file_content = await file.read()
        files = {"file": (file.filename, file_content, file.content_type)}
        
        # Increased timeout for OCR processing - large/complex images can take time
        async with httpx.AsyncClient(timeout=180.0) as client:
            ocr_response = await client.post(
                f"{OCR_SERVICE_URL}/extract",
                files=files
            )
            
            if ocr_response.status_code != 200:
                raise HTTPException(
                    status_code=ocr_response.status_code,
                    detail=f"OCR service error: {ocr_response.text}"
                )
            
            result = ocr_response.json()
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail="OCR extraction failed")
        
        logger.info(f"Successfully extracted text: {len(result.get('text', ''))} characters")
        
        return JSONResponse({
            "success": True,
            "text": result.get("text", ""),
            "message": "Text extracted successfully"
        })
    
    except httpx.RequestError as e:
        logger.error(f"Error communicating with OCR service (network error): {str(e)}")
        raise HTTPException(status_code=503, detail=f"OCR service unavailable: {str(e)}")
    except httpx.HTTPStatusError as e:
        logger.error(f"Error communicating with OCR service (HTTP error): {str(e)}")
        raise HTTPException(status_code=503, detail=f"OCR service error: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing scan request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/generate_quiz")
async def generate_quiz(request: GenerateQuizRequest):
    """
    Orchestrates quiz generation workflow:
    1. Receives extracted text
    2. Sends to LLM service (Ollama) to generate quizzes
    3. Returns quiz questions with answers
    
    Supports multiple quiz types:
    - multiple_choice: Questions with multiple answer options
    - fill_blank: Fill-in-the-blank questions
    - short_answer: Short answer questions
    - all: All types combined
    """
    try:
        text = request.text.strip()
        quiz_type = request.quiz_type.lower()
        
        if not text:
            raise HTTPException(status_code=400, detail="Text input is required")
        
        # Validate quiz type
        valid_types = ["multiple_choice", "fill_blank", "short_answer", "all"]
        if quiz_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid quiz_type. Must be one of: {', '.join(valid_types)}")
        
        logger.info(f"Generating {quiz_type} quiz for text of length {len(text)}")
        
        # Call LLM service to generate quizzes
        # This now uses async httpx and validates that questions were actually generated
        quiz_result = await _generate_quiz_with_llm(text, quiz_type)
        
        # Double-check that we have actual quiz data before returning success
        if not quiz_result:
            raise HTTPException(status_code=500, detail="Quiz generation returned empty result")
        
        # Count total questions generated
        total_questions = sum(len(v) for v in quiz_result.values() if isinstance(v, list))
        if total_questions == 0:
            raise HTTPException(status_code=500, detail="Quiz generation completed but no questions were created")
        
        logger.info(f"Successfully generated quiz with {total_questions} total questions")
        
        return JSONResponse({
            "success": True,
            "quiz": quiz_result,
            "message": f"Quiz generated successfully with {total_questions} questions"
        })
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error generating quiz: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")


@app.post("/api/summary")
async def generate_summary(request: SummaryRequest):
    """
    Orchestrates summary generation workflow:
    1. Receives extracted text
    2. Sends to LLM service to generate summary
    3. Returns summary text
    """
    try:
        text = request.text.strip()
        
        if not text:
            raise HTTPException(status_code=400, detail="Text input is required")
        
        logger.info(f"Generating summary for text of length {len(text)}")
        
        # Call LLM service to generate summary
        summary = await _generate_summary_with_llm(text)
        
        return JSONResponse({
            "success": True,
            "summary": summary,
            "message": "Summary generated successfully"
        })
    
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")


@app.post("/api/generate_flashcards")
async def generate_flashcards(request: SummaryRequest):
    """
    Generate flashcards from text using LLM service
    """
    try:
        text = request.text.strip()
        
        if not text:
            raise HTTPException(status_code=400, detail="Text input is required")
        
        logger.info(f"Generating flashcards for text of length {len(text)}")
        
        flashcards = await _generate_flashcards_with_llm(text)
        
        return JSONResponse({
            "success": True,
            "flashcards": flashcards,
            "message": "Flashcards generated successfully"
        })
    
    except Exception as e:
        logger.error(f"Error generating flashcards: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating flashcards: {str(e)}")


async def _generate_quiz_with_llm(text: str, quiz_type: str) -> Dict:
    """
    Call Ollama LLM service to generate quiz questions
    
    Args:
        text: Input text to generate quiz from
        quiz_type: Type of quiz questions to generate
        
    Returns:
        Dictionary containing quiz questions by type
    """
    import json
    
    # Get model name from environment, default to llama3.2:1b (the model we pulled)
    model_name = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
    result = {}
    
    if quiz_type in ["multiple_choice", "all"]:
        # Scale number of questions based on text length
        # For longer text (multiple documents), generate more questions proportionally
        text_length = len(text)
        if text_length > 10000:
            num_questions = "12-18"
        elif text_length > 5000:
            num_questions = "10-15"
        elif text_length > 3000:
            num_questions = "8-12"
        else:
            num_questions = "5-8"
        
        prompt = f"""Based on the following text, generate {num_questions} multiple choice questions in JSON format.
Create questions covering the important topics and concepts from the text.
For longer text, create more questions to cover the additional content.
Return ONLY a valid JSON array with this structure:
[
    {{
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": 0,
        "explanation": "Brief explanation"
    }},
    ...
]

Text:
{text}

Return only the JSON array, no additional text."""

        system_prompt = """You are an expert educator creating multiple choice questions. 
Each question should have exactly 4 options, with one correct answer (index 0-3).
Questions should test understanding, not just recall."""

        try:
            response = await _call_ollama(prompt, system_prompt, model_name)
            parsed_questions = _parse_json_array(response)
            
            # Validate that we actually got questions - don't return empty arrays silently
            if not parsed_questions or len(parsed_questions) == 0:
                logger.warning("Multiple choice quiz generation returned empty array. Response preview: " + response[:200])
                # Try to provide a fallback or raise an error
                raise Exception("Failed to generate multiple choice questions: LLM returned empty or invalid response")
            
            # Validate question structure
            for i, q in enumerate(parsed_questions):
                if not isinstance(q, dict) or "question" not in q:
                    logger.warning(f"Question {i} missing required fields: {q}")
                if "options" not in q or not isinstance(q.get("options"), list):
                    logger.warning(f"Question {i} missing or invalid options field")
            
            result["multiple_choice"] = parsed_questions
            logger.info(f"Successfully generated {len(parsed_questions)} multiple choice questions")
        except Exception as e:
            logger.error(f"Error generating multiple choice questions: {str(e)}")
            # Re-raise to let the caller know generation failed
            raise
    
    if quiz_type in ["fill_blank", "all"]:
        prompt = f"""Based on the following text, generate 5-7 fill-in-the-blank questions in JSON format.
Return ONLY a valid JSON array with this structure:
[
    {{
        "question": "Sentence with _____ blank",
        "answer": "Correct answer",
        "hint": "Optional hint"
    }},
    ...
]

Text:
{text}

Return only the JSON array, no additional text."""

        system_prompt = """You are an expert educator creating fill-in-the-blank questions.
Each question should have a clear blank space (marked with _____) and a specific correct answer."""

        try:
            response = await _call_ollama(prompt, system_prompt, model_name)
            parsed_questions = _parse_json_array(response)
            
            # Validate that we actually got questions
            if not parsed_questions or len(parsed_questions) == 0:
                logger.warning("Fill-in-the-blank quiz generation returned empty array")
                raise Exception("Failed to generate fill-in-the-blank questions: LLM returned empty or invalid response")
            
            result["fill_blank"] = parsed_questions
            logger.info(f"Successfully generated {len(parsed_questions)} fill-in-the-blank questions")
        except Exception as e:
            logger.error(f"Error generating fill-in-the-blank questions: {str(e)}")
            # Only raise if this was the only requested type
            if quiz_type == "fill_blank":
                raise
    
    if quiz_type in ["short_answer", "all"]:
        prompt = f"""Based on the following text, generate 5-7 short answer questions in JSON format.
Return ONLY a valid JSON array with this structure:
[
    {{
        "question": "Question text",
        "answer": "Expected answer",
        "key_points": ["Point 1", "Point 2"]
    }},
    ...
]

Text:
{text}

Return only the JSON array, no additional text."""

        system_prompt = """You are an expert educator creating short answer questions.
Questions should require thoughtful responses, not just one-word answers."""

        try:
            response = await _call_ollama(prompt, system_prompt, model_name)
            parsed_questions = _parse_json_array(response)
            
            # Validate that we actually got questions
            if not parsed_questions or len(parsed_questions) == 0:
                logger.warning("Short answer quiz generation returned empty array")
                raise Exception("Failed to generate short answer questions: LLM returned empty or invalid response")
            
            result["short_answer"] = parsed_questions
            logger.info(f"Successfully generated {len(parsed_questions)} short answer questions")
        except Exception as e:
            logger.error(f"Error generating short answer questions: {str(e)}")
            # Only raise if this was the only requested type
            if quiz_type == "short_answer":
                raise
    
    # Validate that at least one quiz type was successfully generated
    if not result or all(len(v) == 0 for v in result.values() if isinstance(v, list)):
        raise Exception("Failed to generate any quiz questions. All quiz types failed.")
    
    return result


async def _generate_summary_with_llm(text: str) -> str:
    """Call Ollama LLM service to generate summary"""
    # Get model name from environment, default to llama3.2:1b (the model we pulled)
    model_name = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
    
    # For very long text, request a more comprehensive summary
    text_length = len(text)
    if text_length > 10000:
        summary_instruction = "Create a comprehensive summary covering all main topics, key concepts, and important information from the following text. Make sure to include all major points."
    elif text_length > 5000:
        summary_instruction = "Create a detailed summary of the following text, covering all main ideas, key concepts, and important information."
    else:
        summary_instruction = "Create a concise summary of the following text. Focus on the main ideas, key concepts, and important information."
    
    prompt = f"""{summary_instruction}
Keep it clear and easy to understand.

Text:
{text}

Summary:"""

    system_prompt = """You are an expert at creating concise, informative summaries. 
Create clear and well-structured summaries that capture the main points."""

    summary = await _call_ollama(prompt, system_prompt, model_name)
    return summary


async def _generate_flashcards_with_llm(text: str) -> List[Dict]:
    """Call Ollama LLM service to generate flashcards"""
    import json
    # Get model name from environment, default to llama3.2:1b (the model we pulled)
    model_name = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
    
    # Scale number of flashcards based on text length
    # For longer text (multiple documents), generate more flashcards proportionally
    text_length = len(text)
    if text_length > 10000:
        num_flashcards = "18-22"
    elif text_length > 5000:
        num_flashcards = "15-18"
    elif text_length > 3000:
        num_flashcards = "12-15"
    else:
        num_flashcards = "8-12"
    
    prompt = f"""Based on the following text, generate {num_flashcards} flashcards in JSON format.
Create flashcards covering the important concepts, definitions, and key information from the text.
For longer text, create more flashcards to cover the additional content.
Return ONLY a valid JSON array with this structure:
[
    {{"front": "Question or term", "back": "Answer or definition"}},
    ...
]

Text:
{text}

Return only the JSON array, no additional text."""

    system_prompt = """You are an expert educational content creator. 
Generate flashcards in JSON format from the provided text. 
Each flashcard should have a clear question on the front and a concise answer on the back.
Focus on key concepts, definitions, and important facts."""

    response = await _call_ollama(prompt, system_prompt, model_name)
    return _parse_json_array(response)


async def _call_ollama(prompt: str, system_prompt: str = None, model: str = "llama3") -> str:
    """
    Make API call to Ollama LLM service
    
    Args:
        prompt: User prompt
        system_prompt: Optional system prompt for context
        model: Model name to use
        
    Returns:
        Generated text response
    """
    try:
        url = f"{LLM_SERVICE_URL}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        # Use httpx for async HTTP requests instead of blocking requests.post
        # This prevents blocking the event loop and allows proper async behavior
        # Increased timeout to 15 minutes (900s) to allow parallel requests to complete
        # Using a longer read timeout specifically for LLM generation which can take several minutes
        timeout_config = httpx.Timeout(connect=10.0, read=900.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            logger.info(f"Calling Ollama with model '{model}' at {url}")
            logger.info(f"Prompt length: {len(prompt)} characters")
            
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            response_text = result.get("response", "").strip()
            
            # Log response length for debugging
            logger.info(f"Received LLM response of length {len(response_text)}")
            
            if not response_text:
                logger.warning("Ollama returned empty response")
                raise Exception("LLM returned empty response - model may not have generated content")
            
            return response_text
    
    except httpx.TimeoutException as e:
        logger.error(f"Timeout calling Ollama (took longer than 15 minutes): {str(e)}")
        raise Exception(f"LLM generation timed out after 15 minutes. The model may be too slow. Try using a smaller/faster model or shorter text.")
    except httpx.ConnectError as e:
        logger.error(f"Connection error calling Ollama: {str(e)}")
        raise Exception(f"Failed to connect to LLM service. Make sure Ollama is running: {str(e)}")
    except httpx.RequestError as e:
        error_msg = str(e) if str(e) else "Unknown network error"
        logger.error(f"Error calling Ollama (network error): {error_msg}")
        raise Exception(f"Failed to connect to LLM service: {error_msg}")
    except httpx.HTTPStatusError as e:
        logger.error(f"Error calling Ollama (HTTP error): {str(e)}")
        raise Exception(f"LLM service returned error: {str(e)}")
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        raise Exception(f"Failed to generate content with AI: {str(e)}")


def _parse_json_array(response: str) -> List[Dict]:
    """Parse JSON array from LLM response, handling extra text"""
    import json
    import re
    try:
        # Clean up the response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith('```'):
            # Remove markdown code blocks
            cleaned = re.sub(r'```json\s*', '', cleaned)
            cleaned = re.sub(r'```\s*', '', cleaned)
            cleaned = cleaned.strip()
        
        # Extract JSON from response if there's extra text
        json_start = cleaned.find('[')
        json_end = cleaned.rfind(']') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = cleaned[json_start:json_end]
            parsed = json.loads(json_str)
            logger.info(f"Successfully parsed JSON array with {len(parsed)} items")
            return parsed
        else:
            parsed = json.loads(cleaned)
            logger.info(f"Successfully parsed JSON (direct): {len(parsed) if isinstance(parsed, list) else 'not a list'}")
            return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {str(e)}")
        logger.error(f"Response preview (first 500 chars): {response[:500]}")
        # Try to extract any valid JSON objects
        try:
            # Look for JSON objects in the response
            json_objects = re.findall(r'\{[^{}]*\}', response)
            if json_objects:
                logger.warning(f"Found {len(json_objects)} potential JSON objects, attempting to parse first few")
                parsed_objects = []
                for obj_str in json_objects:  # Parse all found objects, no limit
                    try:
                        parsed_objects.append(json.loads(obj_str))
                    except:
                        pass
                if parsed_objects:
                    logger.info(f"Successfully extracted {len(parsed_objects)} JSON objects")
                    return parsed_objects
        except Exception as e2:
            logger.error(f"Failed to extract JSON objects: {str(e2)}")
        # Return empty array on parse error
        return []


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

