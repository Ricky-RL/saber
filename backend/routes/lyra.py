"""
Lyra music generation route - generates electronic songs for Beat Saber-like gameplay.
"""
import base64
import io
import os
import requests
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from enum import Enum
from pydub import AudioSegment
from config import GOOGLE_PROJECT_ID, GOOGLE_LOCATION, GOOGLE_SERVICE_ACCOUNT_PATH

# Try to import google-auth for OAuth token generation
try:
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    import google.auth
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

router = APIRouter(tags=["lyra"])

if not GOOGLE_PROJECT_ID:
    raise RuntimeError("GOOGLE_PROJECT_ID is required for Vertex AI")


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class GenerateSongRequest(BaseModel):
    difficulty: Difficulty


def get_bpm_from_difficulty(difficulty: Difficulty) -> int:
    """
    Map difficulty level to BPM.
    
    Args:
        difficulty: Game difficulty level
        
    Returns:
        BPM value for the difficulty
    """
    bpm_map = {
        Difficulty.EASY: 110,    # Slower tempo for easier gameplay
        Difficulty.MEDIUM: 130,  # Medium tempo
        Difficulty.HARD: 150,   # Faster tempo for challenging gameplay
    }
    return bpm_map[difficulty]


def get_oauth_token() -> str:
    """
    Get an OAuth access token for Vertex AI.
    Tries multiple methods in order:
    1. Service account JSON file (GOOGLE_APPLICATION_CREDENTIALS env var)
    2. Service account JSON file (GOOGLE_SERVICE_ACCOUNT_PATH from config)
    3. Application Default Credentials (gcloud auth application-default login)
    
    Returns:
        OAuth access token string
    """
    if not GOOGLE_AUTH_AVAILABLE:
        raise ValueError(
            "OAuth authentication required. Install google-auth: "
            "pip install google-auth google-auth-oauthlib google-auth-httplib2"
        )
    
    try:
        # Method 1: Try service account credentials from GOOGLE_APPLICATION_CREDENTIALS env var
        creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            credentials = service_account.Credentials.from_service_account_file(
                creds_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            credentials.refresh(Request())
            return credentials.token
        
        # Method 2: Try service account from config (GOOGLE_SERVICE_ACCOUNT_PATH)
        if GOOGLE_SERVICE_ACCOUNT_PATH and os.path.exists(GOOGLE_SERVICE_ACCOUNT_PATH):
            credentials = service_account.Credentials.from_service_account_file(
                GOOGLE_SERVICE_ACCOUNT_PATH,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            credentials.refresh(Request())
            return credentials.token
        
        # Method 3: Try Application Default Credentials (ADC)
        # This works if user ran: gcloud auth application-default login
        credentials, project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(Request())
        return credentials.token
        
    except Exception as e:
        raise ValueError(
            f"Failed to get OAuth token. Vertex AI requires OAuth authentication. "
            f"Error: {str(e)}\n\n"
            f"To fix this, choose one of these options:\n"
            f"1. Set up Application Default Credentials:\n"
            f"   Run: gcloud auth application-default login\n\n"
            f"2. Use a service account JSON key:\n"
            f"   - Create a service account in Google Cloud Console\n"
            f"   - Download the JSON key file\n"
            f"   - Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n"
            f"     OR set GOOGLE_SERVICE_ACCOUNT_PATH=/path/to/key.json in .env"
        )


def convert_wav_to_mp3(wav_data: bytes) -> bytes:
    """
    Convert WAV audio data to MP3 format.
    
    Args:
        wav_data: WAV audio data as bytes
        
    Returns:
        MP3 audio data as bytes
    """
    # Load WAV from bytes
    audio = AudioSegment.from_wav(io.BytesIO(wav_data))
    # Export as MP3
    mp3_buffer = io.BytesIO()
    audio.export(mp3_buffer, format="mp3", bitrate="192k")
    return mp3_buffer.getvalue()


def generate_song_with_lyra(bpm: int) -> bytes:
    """
    Generate an electronic song using Google's Lyria API via Vertex AI.
    
    Args:
        bpm: Beats per minute
        
    Returns:
        WAV audio data as bytes (48 kHz, instrumental)
    
    Note: Requires GOOGLE_PROJECT_ID and GOOGLE_LOCATION to be set.
    Lyria is only available through Vertex AI, not the simple generativelanguage API.
    """
    # Google's Lyria API endpoint via Vertex AI
    # Note: Returns WAV format (48 kHz), not MP3
    url = f"https://{GOOGLE_LOCATION}-aiplatform.googleapis.com/v1/projects/{GOOGLE_PROJECT_ID}/locations/{GOOGLE_LOCATION}/publishers/google/models/lyria-002:predict"
    
    # Get OAuth token (required for Vertex AI)
    try:
        access_token = get_oauth_token()
    except ValueError as e:
        # Re-raise with helpful message
        raise ValueError(str(e))
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }
    
    prompt = (
        f"Generate an electronic dance music track at {bpm} BPM. "
        f"The song should have a strong, consistent beat perfect for rhythm gameplay. "
        f"Style: high-energy electronic beats suitable for rhythm games like Beat Saber."
    )
    
    # Vertex AI Lyria payload structure
    # Required: prompt (US English)
    # Optional: negative_prompt, seed, sample_count
    payload = {
        "instances": [
            {
                "prompt": prompt,
            }
        ],
        "parameters": {
            "sample_count": 1,  # Number of samples to generate
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    # Provide helpful error messages for common issues
    if response.status_code == 401 or response.status_code == 403:
        error_msg = (
            "Authentication failed. Vertex AI requires OAuth Bearer tokens, not API keys. "
            "You may need to use a service account or generate an OAuth token. "
            f"Error: {response.text}"
        )
        raise ValueError(error_msg)
    elif response.status_code == 404:
        error_msg = (
            f"Model not found. Check that: "
            f"1) Location '{GOOGLE_LOCATION}' supports Lyria, "
            f"2) Project '{GOOGLE_PROJECT_ID}' has Vertex AI API enabled, "
            f"3) The model 'lyria-002' is available in your region. "
            f"Error: {response.text}"
        )
        raise ValueError(error_msg)
    
    response.raise_for_status()
    
    # Parse the response - Vertex AI returns predictions with base64 encoded audio
    response_data = response.json()
    
    # Extract audio data from Vertex AI response structure
    # Vertex AI Lyria returns: { "predictions": [{ "bytesBase64Encoded": "..." }] }
    if "predictions" in response_data and len(response_data["predictions"]) > 0:
        prediction = response_data["predictions"][0]
        
        # Primary structure: bytesBase64Encoded field
        if "bytesBase64Encoded" in prediction:
            audio_base64 = prediction["bytesBase64Encoded"]
            audio_bytes = base64.b64decode(audio_base64)
            return audio_bytes
        
        # Alternative structure: audio field (if different format)
        elif "audio" in prediction:
            audio_data = prediction["audio"]
            if isinstance(audio_data, str):
                audio_bytes = base64.b64decode(audio_data)
                return audio_bytes
            elif isinstance(audio_data, dict) and "bytesBase64Encoded" in audio_data:
                audio_bytes = base64.b64decode(audio_data["bytesBase64Encoded"])
                return audio_bytes
        
        # If prediction exists but no audio found, show what fields are available
        available_fields = list(prediction.keys())
        raise ValueError(
            f"Could not extract audio data from prediction. "
            f"Available fields in prediction: {available_fields}"
        )
    
    # If no predictions found, show response structure for debugging
    raise ValueError(
        f"Could not extract audio data from Google API response. "
        f"Response structure: {list(response_data.keys())}. "
        f"Full response (first 500 chars): {str(response_data)[:500]}"
    )


@router.post("/generate-song")
async def generate_song(request: GenerateSongRequest):
    """
    Generate an electronic song based on difficulty level.
    
    Parameters:
    - difficulty: Game difficulty level (easy, medium, hard)
      - easy: 110 BPM
      - medium: 130 BPM
      - hard: 150 BPM
    
    Returns:
    - MP3 audio file (converted from WAV, ~30 seconds)
    
    Note: Works with Google AI Studio free tier, but subject to rate limits.
    Lyria API returns WAV, which is automatically converted to MP3.
    """
    difficulty = request.difficulty
    bpm = get_bpm_from_difficulty(difficulty)
    genre = "electronic"  # Fixed genre
    
    try:
        # Get WAV from Lyria API
        wav_data = generate_song_with_lyra(bpm)
        # Convert WAV to MP3
        mp3_data = convert_wav_to_mp3(wav_data)
        
        return Response(
            content=mp3_data,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename=electronic_{difficulty}_{bpm}bpm.mp3",
                "X-Genre": genre,
                "X-BPM": str(bpm),
                "X-Difficulty": difficulty.value,
            }
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate song: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating song: {str(e)}"
        )
