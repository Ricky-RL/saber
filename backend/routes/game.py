from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase_client import supabase
from typing import Optional
import base64
import requests
from .jwt import verify_token

router = APIRouter(prefix="/game", tags=["game"])

class GameResult(BaseModel):
    document_id: Optional[str] = None
    player_id: str
    score: int
    accuracy: float
    best_streak: int

@router.post("/results")
def submit_game_result(result: GameResult):
    try:
        data = {
            "user_id": result.player_id,
            "document_id": result.document_id,
            "score": result.score,
            "accuracy": result.accuracy,
            "best_streak": result.best_streak
        }
        
        response = supabase.table("user_statistics").insert(data).execute()
        return {"message": "Game result saved successfully", "data": response.data}
    except Exception as e:
        print(f"Error saving game result: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}")
def get_user_info(user_id: str):
    try:
        user_response = supabase.auth.admin.get_user_by_id(user_id)
        
        if not user_response or not user_response.user:
             raise HTTPException(status_code=404, detail="User not found")
             
        user = user_response.user
        return {
            "name": user.user_metadata.get("full_name") or user.user_metadata.get("name") or "Unknown",
            "email": user.email
        }

    except Exception as e:
        print(f"Error fetching user info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
def get_user_history(user_id: str):
    try:
        # Fetch statistics for the user
        response = supabase.table("user_statistics")\
            .select("*, documents(name)")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
            
        return response.data
    except Exception as e:
        print(f"Error fetching user history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sabers/{user_id}")
def get_user_sabers(user_id: str):
    try:
        # Check for equipped saber pair
        response = supabase.table("user_equipped_items")\
            .select("store_items(value)")\
            .eq("user_id", user_id)\
            .eq("item_type", "saber_pair")\
            .maybe_single()\
            .execute()

        default_left = "#FF00FF"
        default_right = "#00FFFF"

        if response.data and response.data.get('store_items'):
             pair_value = response.data['store_items']['value']
             colors = pair_value.split(',')
             return {
                 "left": colors[0],
                 "right": colors[1] if len(colors) > 1 else colors[0]
             }
        
        # Return default if nothing equipped
        return {
            "left": default_left,
            "right": default_right
        }

    except Exception as e:
        print(f"Error fetching saber colors: {e}")
        # Build resilient fallback
        return {
            "left": "#FF00FF",
            "right": "#00FFFF"
        }

@router.get("/data/{document_id}")
async def get_game_data(document_id: str, user = Depends(verify_token)):
    """
    Fetch quiz and music data for an existing document.
    
    This endpoint retrieves previously generated quiz and music for a document.
    It's used when playing an existing document (from Home or Explore pages).
    
    Parameters:
    - document_id: UUID of the document
    
    Returns a JSON response with:
    - quiz: Quiz data with questions
    - music_data: Base64-encoded music file (for immediate use in game)
    - music_file_path: Path to stored music file in Supabase
    - difficulty: Stored difficulty level
    - document_id: The document ID
    """
    try:
        # 1. Fetch document directly from database
        response = supabase.table("documents").select("*").eq("id", document_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document = response.data
        
        # 2. Check if quiz exists
        quiz_data = document.get("quiz")
        if not quiz_data:
            raise HTTPException(
                status_code=404,
                detail="Quiz not found for this document. Please generate quiz first."
            )
        
        # 3. Check if music file path exists
        music_file_path = document.get("music_file_path")
        if not music_file_path:
            raise HTTPException(
                status_code=404,
                detail="Music file not found for this document. Please generate music first."
            )
        
        # 4. Get difficulty (default to 'easy' if not set)
        difficulty = document.get("difficulty", "easy")
        
        # 5. Download music file from Supabase storage
        try:
            # Get signed URL for the music file
            music_url_response = supabase.storage.from_("documents").create_signed_url(
                music_file_path, 
                3600  # 1 hour expiry
            )
            
            # Extract URL from response
            if isinstance(music_url_response, dict) and 'signedURL' in music_url_response:
                music_url = music_url_response['signedURL']
            elif isinstance(music_url_response, str):
                music_url = music_url_response
            elif hasattr(music_url_response, 'signedURL'):
                music_url = music_url_response.signedURL
            else:
                music_url = music_url_response
            
            # Download music file
            music_response = requests.get(music_url, timeout=30)
            music_response.raise_for_status()
            music_bytes = music_response.content
            
            # Encode to base64
            music_base64 = base64.b64encode(music_bytes).decode("utf-8")
            
        except Exception as music_error:
            print(f"Error downloading music file: {music_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to download music file: {str(music_error)}"
            )
        
        # 6. Return data in same format as POST endpoint
        return {
            "quiz": quiz_data,
            "music_data": music_base64,  # Base64-encoded music file
            "music_file_path": music_file_path,
            "difficulty": difficulty,
            "document_id": document_id
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Error fetching game data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching game data: {str(e)}"
        )
