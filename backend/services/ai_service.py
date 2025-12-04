"""
AI Service for generating flashcards, summaries, and questions
Uses Ollama LLM for content generation
"""

import requests
import logging
import os
import json

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered content generation using Ollama"""
    
    def __init__(self):
        """Initialize AI service with Ollama connection"""
        self.ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
        self.model_name = os.getenv("OLLAMA_MODEL", "llama3")
        logger.info(f"AI Service initialized with model: {self.model_name}")
    
    async def _call_ollama(self, prompt: str, system_prompt: str = None) -> str:
        """
        Make API call to Ollama LLM
        
        Args:
            prompt: User prompt
            system_prompt: Optional system prompt for context
            
        Returns:
            Generated text response
        """
        try:
            url = f"{self.ollama_url}/api/generate"
            
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False
            }
            
            if system_prompt:
                payload["system"] = system_prompt
            
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            
            result = response.json()
            return result.get("response", "").strip()
        
        except Exception as e:
            logger.error(f"Error calling Ollama: {str(e)}")
            raise Exception(f"Failed to generate content with AI: {str(e)}")
    
    async def generate_flashcards(self, text: str) -> list:
        """
        Generate flashcards from input text
        
        Args:
            text: Input text to generate flashcards from
            
        Returns:
            List of flashcards, each with front and back
        """
        try:
            logger.info("Generating flashcards")
            
            system_prompt = """You are an expert educational content creator. 
            Generate flashcards in JSON format from the provided text. 
            Each flashcard should have a clear question on the front and a concise answer on the back.
            Focus on key concepts, definitions, and important facts."""
            
            prompt = f"""Based on the following text, generate 5-10 flashcards in JSON format.
            Return ONLY a valid JSON array with this structure:
            [
                {{"front": "Question or term", "back": "Answer or definition"}},
                ...
            ]
            
            Text:
            {text}
            
            Return only the JSON array, no additional text."""
            
            response = await self._call_ollama(prompt, system_prompt)
            
            # Parse JSON response
            try:
                # Extract JSON from response if there's extra text
                json_start = response.find('[')
                json_end = response.rfind(']') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    flashcards = json.loads(json_str)
                else:
                    flashcards = json.loads(response)
                
                logger.info(f"Generated {len(flashcards)} flashcards")
                return flashcards
            
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse flashcards JSON: {str(e)}")
                # Fallback: create a simple flashcard structure
                return [{"front": "Content from text", "back": response[:200]}]
        
        except Exception as e:
            logger.error(f"Error generating flashcards: {str(e)}")
            raise Exception(f"Failed to generate flashcards: {str(e)}")
    
    async def generate_summary(self, text: str) -> str:
        """
        Generate a concise summary of the input text
        
        Args:
            text: Input text to summarize
            
        Returns:
            Summary text
        """
        try:
            logger.info("Generating summary")
            
            system_prompt = """You are an expert at creating concise, informative summaries. 
            Create clear and well-structured summaries that capture the main points."""
            
            prompt = f"""Create a concise summary of the following text. 
            Focus on the main ideas, key concepts, and important information.
            Keep it clear and easy to understand.
            
            Text:
            {text}
            
            Summary:"""
            
            summary = await self._call_ollama(prompt, system_prompt)
            logger.info("Summary generated successfully")
            return summary
        
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise Exception(f"Failed to generate summary: {str(e)}")
    
    async def generate_questions(self, text: str) -> list:
        """
        Generate study questions from input text
        
        Args:
            text: Input text to generate questions from
            
        Returns:
            List of questions with answers
        """
        try:
            logger.info("Generating questions")
            
            system_prompt = """You are an expert educator. 
            Create thoughtful study questions that test understanding of the material.
            Include both factual questions and conceptual questions."""
            
            prompt = f"""Based on the following text, generate 5-8 study questions in JSON format.
            Return ONLY a valid JSON array with this structure:
            [
                {{"question": "Question text", "answer": "Answer text"}},
                ...
            ]
            
            Text:
            {text}
            
            Return only the JSON array, no additional text."""
            
            response = await self._call_ollama(prompt, system_prompt)
            
            # Parse JSON response
            try:
                json_start = response.find('[')
                json_end = response.rfind(']') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    questions = json.loads(json_str)
                else:
                    questions = json.loads(response)
                
                logger.info(f"Generated {len(questions)} questions")
                return questions
            
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse questions JSON: {str(e)}")
                # Fallback: create a simple question structure
                return [{"question": "What are the main points?", "answer": response[:200]}]
        
        except Exception as e:
            logger.error(f"Error generating questions: {str(e)}")
            raise Exception(f"Failed to generate questions: {str(e)}")

