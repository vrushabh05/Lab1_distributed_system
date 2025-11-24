import os
from core import config, create_logger

# Ensure downstream Ollama client picks up the correct host before importing the SDK
if config.OLLAMA_API:
    os.environ['OLLAMA_HOST'] = config.OLLAMA_API

import json
import re
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

llm_logger = create_logger('agent-llm')

if config.OLLAMA_API:
    llm_logger.info("Ollama host configured", extra={"host": config.OLLAMA_API})

llm = ChatOllama(
    base_url=config.OLLAMA_API,
    model=config.OLLAMA_MODEL,
    temperature=0.2,  # lower temp for more deterministic JSON
)

# Define the prompt template for itinerary generation
itinerary_prompt = ChatPromptTemplate.from_template("""
You are an expert travel agent. Create a detailed day-by-day itinerary for a trip to {location} for {duration} days.
The traveler has the following preferences: {preferences}.

Return the response strictly as a JSON array of objects, where each object represents a day and has the following keys:
- "day": "YYYY-MM-DD" (calculate based on start date: {start_date})
- "morning": ["activity 1", "activity 2"]
- "afternoon": ["activity 1", "activity 2"]
- "evening": ["activity 1", "activity 2"]

Do not include any markdown formatting (like ```json) or extra text. Just the raw JSON array.
""")

def generate_itinerary(location: str, start_date: str, duration: int, preferences: str):
    """
    Generates a travel itinerary using LangChain and Ollama.
    """
    try:
        llm_logger.info(f"Generating itinerary for {location} ({duration} days) starting {start_date}")
        messages = itinerary_prompt.format_messages(
            location=location,
            duration=duration,
            preferences=preferences,
            start_date=start_date
        )

        result = llm.invoke(messages)
        raw_text = getattr(result, 'content', None) or str(result)

        # Try direct JSON parse
        try:
          return json.loads(raw_text)
        except Exception:
          pass

        # Try to extract the first JSON array substring
        match = re.search(r"\[.*\]", raw_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                llm_logger.warning("Failed to parse extracted JSON substring")

        llm_logger.error(f"LangChain generation failed to parse JSON", extra={"sample": raw_text[:2000]})
        return []
    except Exception as e:
        llm_logger.error(f"LangChain generation failed: {e}")
        return []
