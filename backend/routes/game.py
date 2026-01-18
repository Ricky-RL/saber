from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase_client import supabase
from typing import Optional

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
