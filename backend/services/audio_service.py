"""
Audio Service for transcribing audio recordings
Uses Whisper or similar speech-to-text model for transcription
"""

import logging
import os
import subprocess
import requests

logger = logging.getLogger(__name__)


class AudioService:
    """Service for transcribing audio to text"""
    
    def __init__(self):
        """Initialize audio service"""
        self.whisper_api_url = os.getenv("WHISPER_API_URL", "http://whisper-service:9000/transcribe")
        logger.info("Audio Service initialized")
    
    async def transcribe_audio(self, audio_path: str) -> str:
        """
        Transcribe audio file to text
        
        Args:
            audio_path: Path to the audio file
            
        Returns:
            Transcribed text as string
        """
        try:
            logger.info(f"Transcribing audio file: {audio_path}")
            
            # Option 1: Use Whisper API (if available)
            if os.getenv("USE_WHISPER_API", "false").lower() == "true":
                with open(audio_path, "rb") as audio_file:
                    files = {"file": audio_file}
                    response = requests.post(self.whisper_api_url, files=files, timeout=60)
                    response.raise_for_status()
                    result = response.json()
                    transcribed_text = result.get("text", "")
            
            # Option 2: Use local Whisper (via subprocess or library)
            else:
                # Fallback: Use a simple transcription approach
                # In production, integrate with Whisper model via Ollama or direct API
                transcribed_text = await self._transcribe_with_whisper_local(audio_path)
            
            if not transcribed_text or len(transcribed_text.strip()) == 0:
                logger.warning("No text transcribed from audio")
                return "No speech could be transcribed from the audio. Please ensure the audio is clear and contains speech."
            
            logger.info(f"Successfully transcribed {len(transcribed_text)} characters")
            return transcribed_text.strip()
        
        except Exception as e:
            logger.error(f"Error in audio transcription: {str(e)}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")
    
    async def _transcribe_with_whisper_local(self, audio_path: str) -> str:
        """
        Transcribe using local Whisper model
        This is a placeholder - in production, integrate with Ollama Whisper or direct Whisper API
        """
        # For now, return a placeholder
        # In production, this would call Ollama with Whisper model or use whisper library
        logger.warning("Using placeholder transcription - integrate with Whisper model")
        return "Placeholder transcription. Please integrate with Whisper model via Ollama or direct API."

