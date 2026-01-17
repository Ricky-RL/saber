import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

JWT_SECRET = os.environ.get("JWT_SECRET", "myrandomkey")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
