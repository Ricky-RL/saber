import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

JWT_SECRET = os.environ.get("JWT_SECRET", "myrandomkey")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
# Required for Vertex AI (for Lyria)
GOOGLE_PROJECT_ID = os.environ.get("GOOGLE_PROJECT_ID")
GOOGLE_LOCATION = os.environ.get("GOOGLE_LOCATION", "us-central1")
# Service account JSON key file path (alternative to GOOGLE_APPLICATION_CREDENTIALS env var)
GOOGLE_SERVICE_ACCOUNT_PATH = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH")