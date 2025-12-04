"""
Text-to-Speech Service for reading questions aloud
Uses TTS API or library to convert text to speech
"""

import logging
import os
import requests
import base64

logger = logging.getLogger(__name__)


class TTSService:
    """Service for converting text to speech"""
    
    def __init__(self):
        """Initialize TTS service"""
        self.tts_api_url = os.getenv("TTS_API_URL", "http://tts-service:8001/synthesize")
        self.use_local_tts = os.getenv("USE_LOCAL_TTS", "true").lower() == "true"
        logger.info("TTS Service initialized")
    
    async def synthesize_speech(self, text: str) -> str:
        """
        Convert text to speech audio
        
        Args:
            text: Text to convert to speech
            
        Returns:
            Base64 encoded audio data or audio file path
        """
        try:
            logger.info(f"Synthesizing speech for text: {text[:50]}...")
            
            if self.use_local_tts:
                # Use local TTS (e.g., pyttsx3, gTTS, or Ollama TTS)
                audio_data = await self._synthesize_local(text)
            else:
                # Use external TTS API
                audio_data = await self._synthesize_api(text)
            
            logger.info("Speech synthesized successfully")
            return audio_data
        
        except Exception as e:
            logger.error(f"Error in TTS synthesis: {str(e)}")
            raise Exception(f"Failed to synthesize speech: {str(e)}")
    
    async def _synthesize_local(self, text: str) -> str:
        """
        Synthesize speech using local TTS library
        Returns base64 encoded audio
        """
        try:
            # Option 1: Use gTTS (Google Text-to-Speech)
            from gtts import gTTS
            import io
            
            tts = gTTS(text=text, lang='en', slow=False)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            
            # Convert to base64
            audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
            return audio_base64
        
        except ImportError:
            logger.warning("gTTS not available, using placeholder")
            # Fallback: return placeholder
            return "TTS_NOT_AVAILABLE"
    
    async def _synthesize_api(self, text: str) -> str:
        """
        Synthesize speech using external TTS API
        """
        try:
            response = requests.post(
                self.tts_api_url,
                json={"text": text},
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            return result.get("audio", "")
        
        except Exception as e:
            logger.error(f"Error calling TTS API: {str(e)}")
            raise Exception(f"TTS API call failed: {str(e)}")

