import os
from core import config, create_logger

# Ensure downstream Ollama client picks up the correct host before importing the SDK
if config.OLLAMA_API:
    os.environ['OLLAMA_HOST'] = config.OLLAMA_API

from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

llm_logger = create_logger('agent-llm')

if config.OLLAMA_API:
    llm_logger.info("Ollama host configured", extra={"host": config.OLLAMA_API})

llm = ChatOllama(
    base_url=config.OLLAMA_API,
    model=config.OLLAMA_MODEL,
    temperature=0.7
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

# Create the chain
itinerary_chain = itinerary_prompt | llm | JsonOutputParser()

def generate_itinerary(location: str, start_date: str, duration: int, preferences: str):
    """
    Generates a travel itinerary using LangChain and Ollama.
    """
    try:
        llm_logger.info(f"Generating itinerary for {location} ({duration} days) starting {start_date}")
        response = itinerary_chain.invoke({
            "location": location,
            "duration": duration,
            "preferences": preferences,
            "start_date": start_date
        })
        return response
    except Exception as e:
        llm_logger.error(f"LangChain generation failed: {e}")
        return []
