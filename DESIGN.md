# AI Context-Aware Study Coach - Complete Design Document

## 1. Project Overview

The AI Context-Aware Study Coach is a mobile application that leverages AI to transform real-world study materials (handwritten or printed notes) into interactive study content. The application uses camera-based OCR (hardware input) and employs an LLM (Ollama) to generate flashcards, summaries, and quizzes. The system displays quizzes on the device screen (hardware output - display), provides TTS audio playback (hardware output - audio), and triggers vibration alerts (hardware output - haptic).

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile Application (React Native)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Camera     │  │   Display    │  │   Audio/TTS   │         │
│  │  (Input)     │  │  (Output)    │  │   (Output)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTP/REST API
                     │
┌────────────────────▼────────────────────────────────────────────┐
│              API Gateway / Orchestrator Service                 │
│                    (FastAPI - Port 8000)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Endpoints:                                               │  │
│  │  - POST /api/scan          (Image → OCR → Text)          │  │
│  │  - POST /api/generate_quiz (Text → LLM → Quiz)          │  │
│  │  - POST /api/summary       (Text → LLM → Summary)        │  │
│  │  - POST /api/generate_flashcards                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────┬───────────────────────────────┬─────────────────────────┘
        │                               │
        │ HTTP                          │ HTTP
        │                               │
┌───────▼────────┐            ┌────────▼──────────────────────┐
│  OCR Service   │            │    Ollama LLM Service          │
│  (FastAPI)     │            │    (Docker Container)         │
│  Port: 8001    │            │    Port: 11434                 │
│                │            │                                │
│  - Tesseract   │            │  - llama3.2:1b model          │
│  - Image Proc  │            │  - Quiz Generation             │
│  - Text Extract│            │  - Summary Generation          │
└────────────────┘            │  - Flashcard Generation       │
                              └────────────────────────────────┘
```

## 3. Component Flow

### 3.1 Complete Data Flow

```
1. User Action (Hardware Input)
   └─> Mobile App: User taps "Scan Notes"
       └─> Camera opens (hardware input)
           └─> User captures image
               └─> Image uploaded to API Gateway

2. OCR Processing
   └─> API Gateway receives image
       └─> Forwards to OCR Service
           └─> OCR Service extracts text using Tesseract
               └─> Returns extracted text to API Gateway
                   └─> API Gateway returns text to Mobile App

3. AI Content Generation
   └─> Mobile App sends text to API Gateway
       └─> API Gateway calls Ollama LLM Service
           └─> LLM generates:
               - Multiple choice questions
               - Summary
               - Flashcards
           └─> Returns generated content to API Gateway
               └─> API Gateway returns to Mobile App

4. Display & Interaction (Hardware Output)
   └─> Mobile App displays:
       - Quiz questions (hardware output - display)
       - Summary (hardware output - display)
       - Flashcards (hardware output - display)
   └─> User interactions:
       - Tap to reveal answers (triggers vibration - hardware output)
       - Tap TTS button (plays audio - hardware output)
       - Select multiple choice options (triggers vibration)
```

### 3.2 Service Communication

```
Mobile App (React Native)
    │
    │ HTTP POST /api/scan
    ▼
API Gateway (FastAPI)
    │
    │ HTTP POST /extract
    ▼
OCR Service (FastAPI)
    │
    │ Returns: {"success": true, "text": "..."}
    ▼
API Gateway
    │
    │ Returns to Mobile App
    ▼
Mobile App
    │
    │ HTTP POST /api/generate_quiz
    ▼
API Gateway
    │
    │ HTTP POST /api/generate
    ▼
Ollama LLM Service
    │
    │ Returns: {"response": "..."}
    ▼
API Gateway
    │
    │ Parses JSON, returns quiz
    ▼
Mobile App (displays quiz)
```

## 4. Microservice Architecture

### 4.1 OCR Microservice

**Location**: `ocr-service/`

**Technology**: Python FastAPI, Tesseract OCR

**Responsibilities**:
- Accept image uploads
- Extract text using Tesseract OCR
- Return extracted text as JSON

**Endpoints**:
- `GET /health` - Health check
- `POST /extract` - Extract text from image

**Dependencies**:
- Tesseract OCR (system package)
- Pillow (image processing)
- FastAPI (web framework)

### 4.2 API Gateway / Orchestrator Service

**Location**: `api-gateway/`

**Technology**: Python FastAPI

**Responsibilities**:
- Coordinate communication between services
- Route requests to appropriate microservices
- Aggregate responses from multiple services
- Handle error cases and service failures

**Endpoints**:
- `GET /health` - Health check with service status
- `POST /api/scan` - Orchestrate image scanning workflow
- `POST /api/generate_quiz` - Orchestrate quiz generation
- `POST /api/summary` - Orchestrate summary generation
- `POST /api/generate_flashcards` - Orchestrate flashcard generation

**Key Functions**:
- `_generate_quiz_with_llm()` - Calls Ollama for quiz generation
- `_generate_summary_with_llm()` - Calls Ollama for summary
- `_call_ollama()` - Generic Ollama API caller
- `_parse_json_array()` - Parses LLM JSON responses

### 4.3 Ollama LLM Service

**Location**: Docker container (`ollama/ollama:latest`)

**Technology**: Ollama (local LLM runtime)

**Responsibilities**:
- Run LLM models (llama3.2:1b)
- Generate educational content:
  - Multiple choice questions
  - Summaries
  - Flashcards

**API**: REST API on port 11434
- `POST /api/generate` - Generate text with LLM

## 5. Hardware Interaction

### 5.1 Hardware Input

**Camera (Phone Camera)**:
- **Purpose**: Capture images of handwritten or printed notes
- **Implementation**: React Native `expo-image-picker` with camera access
- **Flow**: User taps "Scan Notes" → Camera opens → User captures image → Image sent to backend

### 5.2 Hardware Output

**Display (Phone Screen)**:
- **Purpose**: Display quiz questions, answers, summaries, flashcards
- **Implementation**: React Native components with tap-to-reveal functionality
- **Features**:
  - Multiple choice questions with selectable options
  - Summary text display
  - Flashcard display

**Audio/TTS (Phone Speakers)**:
- **Purpose**: Read questions, summaries, and flashcards aloud
- **Implementation**: Expo Speech API (`expo-speech`)
- **Features**:
  - TTS button on each question
  - TTS button on summary
  - TTS button on flashcards
  - Configurable speech rate and pitch

**Vibration (Phone Haptic Feedback)**:
- **Purpose**: Provide tactile feedback for user interactions
- **Implementation**: React Native `Vibration` API
- **Triggers**:
  - When quiz content is generated (200ms vibration)
  - When answer is revealed (50ms vibration)
  - When option is selected (50ms vibration)

## 6. AI Integration Details

### 6.1 Ollama LLM Integration

**Model**: llama3.2:1b (configurable via `OLLAMA_MODEL` environment variable)

**API Endpoint**: `http://ollama:11434/api/generate`

**Request Format**:
```json
{
  "model": "llama3.2:1b",
  "prompt": "User prompt text",
  "system": "System prompt text",
  "stream": false
}
```

**Response Format**:
```json
{
  "response": "Generated text response"
}
```

### 6.2 Quiz Generation Prompts

#### Multiple Choice Questions

**System Prompt**:
```
You are an expert educator creating multiple choice questions. 
Each question should have exactly 4 options, with one correct answer (index 0-3).
Questions should test understanding, not just recall.
```

**User Prompt**:
```
Based on the following text, generate 5-7 multiple choice questions in JSON format.
Return ONLY a valid JSON array with this structure:
[
    {
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": 0,
        "explanation": "Brief explanation"
    },
    ...
]

Text: [extracted text]

Return only the JSON array, no additional text.
```

### 6.3 Summary Generation

**System Prompt**:
```
You are an expert at creating concise, informative summaries. 
Create clear and well-structured summaries that capture the main points.
```

**User Prompt**:
```
Create a concise summary of the following text. 
Focus on the main ideas, key concepts, and important information.
Keep it clear and easy to understand.

Text: [extracted text]

Summary:
```

### 6.4 Flashcard Generation

**System Prompt**:
```
You are an expert educational content creator. 
Generate flashcards in JSON format from the provided text. 
Each flashcard should have a clear question on the front and a concise answer on the back.
Focus on key concepts, definitions, and important facts.
```

**User Prompt**:
```
Based on the following text, generate 8-12 flashcards in JSON format.
Return ONLY a valid JSON array with this structure:
[
    {"front": "Question or term", "back": "Answer or definition"},
    ...
]

Text: [extracted text]

Return only the JSON array, no additional text.
```

## 7. AI Tool Mapping Table

| AI Tool | Purpose | Where Used | Contribution to Project | Justification |
|---------|---------|------------|------------------------|---------------|
| **ChatGPT / Cursor** | Code generation and development assistance | Throughout entire project | Generated ~60% of core integration code including: API endpoints, service classes, Docker configuration, error handling patterns, test structure, and prompt engineering | **Justification:** Used for rapid prototyping and code generation. Significantly accelerated development by generating boilerplate code, API structures, and integration patterns. Provided best practices for FastAPI, React Native, and Docker. Helped with debugging and troubleshooting service communication issues. |
| **Ollama (llama3.2:1b)** | Content generation via LLM | API Gateway → Ollama Service | Core AI engine for generating flashcards, summaries, and quiz questions from extracted text. Handles natural language understanding and educational content creation. Generates structured JSON responses for quizzes. | **Justification:** Chosen for privacy (local processing, no external API calls), cost-effectiveness (free, runs locally), and educational suitability. The llama3.2:1b model provides good balance between quality and performance. Used for all AI content generation tasks including quiz questions, summaries, and flashcards. |
| **Tesseract OCR** | Text extraction from images | OCR Service | Extracts text from camera-captured images of notes. Pre-trained model for optical character recognition. Handles both printed and handwritten text (with varying accuracy). | **Justification:** Industry-standard OCR tool with proven accuracy for printed text. Open-source and well-documented. Provides hardware input requirement (camera → text extraction). Essential for converting scanned notes into processable text for LLM generation. |
| **Expo Speech (TTS)** | Text-to-speech synthesis | Mobile App | Converts generated questions, summaries, and flashcards to audio for reading aloud. Provides hardware output action (audio playback). | **Justification:** Native Expo library for TTS functionality. Provides hardware output requirement (audio). Enhances accessibility and learning experience by allowing users to hear questions and content. Easy to integrate with React Native. |

### AI-Generated Code Breakdown

**Estimated 50%+ AI-generated code:**

1. **API Gateway Service** (~70% AI-assisted):
   - Endpoint structure and routing
   - Service orchestration logic
   - Error handling patterns
   - JSON parsing utilities
   - Ollama API integration

2. **OCR Service** (~65% AI-assisted):
   - FastAPI endpoint setup
   - Image processing workflow
   - Error handling
   - Health check implementation

3. **Docker Configuration** (~80% AI-assisted):
   - `docker-compose.yml` structure
   - Service definitions
   - Network configuration
   - Volume mounts
   - Health checks

4. **React Native Frontend** (~55% AI-assisted):
   - Component structure
   - API integration code
   - Quiz rendering logic
   - TTS integration
   - Vibration handling

5. **Test Suite** (~60% AI-assisted):
   - Unit test structure
   - Integration test workflows
   - Mock setup patterns
   - Edge case test scenarios

6. **Prompt Engineering** (~75% AI-assisted):
   - Quiz generation prompts
   - System prompts for LLM
   - JSON structure definitions
   - Educational content guidelines

## 8. Data Flow Description

### 8.1 Scan Notes Workflow

```
1. User Action
   User → Mobile App: Tap "Scan Notes" button
   
2. Camera Input (Hardware)
   Mobile App → Camera: Open camera interface
   User → Camera: Capture image
   Camera → Mobile App: Image URI
   
3. Image Upload
   Mobile App → API Gateway: POST /api/scan
   Body: FormData with image file
   
4. OCR Processing
   API Gateway → OCR Service: POST /extract
   OCR Service → Tesseract: Process image
   Tesseract → OCR Service: Extracted text
   OCR Service → API Gateway: {"success": true, "text": "..."}
   
5. Response
   API Gateway → Mobile App: Extracted text
   Mobile App: Store text, trigger content generation
```

### 8.2 Quiz Generation Workflow

```
1. Content Generation Request
   Mobile App → API Gateway: POST /api/generate_quiz
   Body: {"text": "...", "quiz_type": "all"}
   
2. LLM Service Call
   API Gateway → Ollama: POST /api/generate
   Body: {
     "model": "llama3.2:1b",
     "prompt": "Generate quiz...",
     "system": "You are an expert educator..."
   }
   
3. LLM Processing
   Ollama → LLM Model: Process prompt
   LLM Model → Ollama: Generated JSON response
   Ollama → API Gateway: {"response": "[{...}]"}
   
4. Response Processing
   API Gateway: Parse JSON response
   API Gateway: Structure quiz data
   API Gateway → Mobile App: {
     "success": true,
     "quiz": {
       "multiple_choice": [...],
       "fill_blank": [...],
       "short_answer": [...]
     }
   }
   
5. Display (Hardware Output)
   Mobile App: Render quiz questions
   Mobile App: Display on screen
   Mobile App: Enable tap-to-reveal
   Mobile App: Enable TTS buttons
   Mobile App: Enable vibration on interactions
```

## 9. Services and Communication Paths

### 9.1 Service Network

```
study-coach-network (Docker Bridge Network)
│
├── ocr-service (Port 8001)
│   └── Accessible at: http://ocr-service:8001
│
├── ollama (Port 11434)
│   └── Accessible at: http://ollama:11434
│
└── api-gateway (Port 8000)
    └── Accessible at: http://api-gateway:8000
    └── Exposed to host: localhost:8000
```

### 9.2 Communication Paths

**Internal (Docker Network)**:
- API Gateway → OCR Service: `http://ocr-service:8001`
- API Gateway → Ollama: `http://ollama:11434`

**External (Host Network)**:
- Mobile App → API Gateway: `http://<host-ip>:8000`
- Health Checks: `http://localhost:8000/health`

## 10. Environment Configuration

### 10.1 API Gateway Environment Variables

```bash
OCR_SERVICE_URL=http://ocr-service:8001
LLM_SERVICE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b
TTS_ENABLED=true
```

### 10.2 OCR Service Environment Variables

```bash
TESSERACT_CMD=/usr/bin/tesseract
```

### 10.3 Docker Compose Configuration

- **Networks**: `study-coach-network` (bridge driver)
- **Volumes**: `ollama-data` (persistent model storage)
- **Ports**:
  - API Gateway: `8000:8000`
  - OCR Service: `8001:8001`
  - Ollama: `11434:11434`

## 11. Deployment

### 11.1 Docker Compose Deployment

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 11.2 Model Setup

```bash
# Pull Ollama model (first time)
docker exec study-coach-ollama ollama pull llama3.2:1b

# Verify model
docker exec study-coach-ollama ollama list
```

### 11.3 Health Checks

```bash
# API Gateway
curl http://localhost:8000/health

# OCR Service
curl http://localhost:8001/health

# Ollama
curl http://localhost:11434/api/tags
```

## 12. Testing

See `tests/TESTING_WALKTHROUGH.md` for comprehensive testing documentation.

**Test Status**: 29 tests passing, 0 failed, 0 skipped - 100% pass rate

**Test Categories**:
- Unit tests for each microservice (using mocks - no service dependencies)
- Integration tests for complete workflows (gracefully handle service unavailability)
- Edge case tests (blurry images, short text, service failures, timeouts)

**Coverage**:
- ✅ Image scanning (OCR) - Tested via API Gateway and integration tests
- ✅ Multiple choice quiz generation - Fully tested
- ✅ Summary generation - Tested via integration tests
- ✅ Flashcard generation - Fully tested
- ✅ Health checks - All services tested
- ✅ Comprehensive edge cases - All identified scenarios covered

## 13. Future Enhancements

- Enhanced OCR with better handwriting recognition
- Offline mode support
- User accounts and content persistence
- Spaced repetition algorithm for flashcards
- Multi-language support
- Audio input (lecture recording) with Whisper transcription
- Advanced quiz analytics and progress tracking

## 14. Assignment Requirements Compliance

✅ **Hardware Input**: Phone camera for scanning notes  
✅ **Hardware Output**: Display (quiz), TTS (audio), Vibration (haptic)  
✅ **AI-Driven Core Logic**: Ollama LLM generates all content  
✅ **50%+ AI-Generated Code**: Integration code, API interfaces, prompts  
✅ **Microservice Architecture**: OCR, LLM, API Gateway services  
✅ **Dockerized**: All services containerized with docker-compose  
✅ **Quiz Types**: Multiple choice, fill-in-blank, short answer  
✅ **Testing**: Comprehensive test suite with edge cases  
✅ **Documentation**: Complete design document with architecture diagrams
