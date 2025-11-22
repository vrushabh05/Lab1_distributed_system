# services/agent-service/core/config.py
import os
from dotenv import load_dotenv

# Load .env file from the current directory
load_dotenv()

class Config:
    # Service
    SERVICE_NAME = 'agent-service'
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
    NODE_ENV = os.environ.get('NODE_ENV', 'development')

    # CORS
    CORS_ORIGIN = os.environ.get('CORS_ORIGIN', 'http://localhost:5173').split(',')

    # Database
    MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://admin:adminpassword@mongodb:27017/airbnb?authSource=admin')

    # APIs
    TAVILY_API_KEY = os.environ.get('TAVILY_API_KEY', '')
    OLLAMA_API = os.environ.get('OLLAMA_BASE_URL', os.environ.get('OLLAMA_API', 'http://localhost:11434'))
    OLLAMA_MODEL = os.environ.get('AGENT_MODEL', os.environ.get('OLLAMA_MODEL', 'qwen2.5-coder:1.5b-base'))
    USE_OLLAMA = os.environ.get('USE_OLLAMA', 'true').lower() == 'true'
    API_TIMEOUT = int(os.environ.get('API_TIMEOUT', 30))

    # Security
    JWT_SECRET = os.environ.get('JWT_SECRET', '')

    def is_development(self):
        return self.NODE_ENV == 'development'

# Singleton instance
config = Config()
