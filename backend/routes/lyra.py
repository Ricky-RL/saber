"""
Lyra music generation route - generates electronic songs for Beat Saber-like gameplay.
"""
import requests
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from enum import Enum
from config import OPENROUTER_API_KEY

router = APIRouter(tags=["lyra"])

if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY is not set")


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


def generate_song_with_lyra(bpm: int) -> bytes:
    """
    Generate an electronic song using Lyra via OpenRouter API.
    
    Args:
        bpm: Beats per minute
        
    Returns:
        MP3 audio data as bytes
    """
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "Rhythm Quiz Game Backend",
    }
    
    payload = {
        "model": "meta/musicgen",  # Update with actual Lyra model name if different
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a music generation assistant specializing in electronic dance music. "
                    "Generate high-energy electronic beats suitable for rhythm games like Beat Saber."
                ),
            },
            {
                "role": "user",
                "content": f"Generate an electronic dance music track at {bpm} BPM. "
                           f"The song should have a strong, consistent beat perfect for rhythm gameplay. "
                           f"Return the audio as MP3 format.",
            },
        ],
        "temperature": 0.7,
        "response_format": {"type": "audio"},  # Request audio format
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    
    # Return the audio bytes
    return response.content


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
    - MP3 audio file
    """
    difficulty = request.difficulty
    bpm = get_bpm_from_difficulty(difficulty)
    genre = "electronic"  # Fixed genre
    
    try:
        mp3_data = generate_song_with_lyra(bpm)
        
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
