from fastapi import APIRouter, HTTPException
from supabase_client import supabase
from datetime import datetime
from collections import Counter
import statistics

router = APIRouter(prefix="/wrapped", tags=["wrapped"])

@router.get("/{user_id}")
def get_wrapped_stats(user_id: str):
    # Get current year
    current_year = datetime.now().year
    start_date = f"{current_year}-01-01"
    end_date = f"{current_year}-12-31"

    # Fetch User Stats
    try:
        user_stats_res = supabase.table("user_statistics")\
            .select("*")\
            .eq("user_id", user_id)\
            .gte("created_at", start_date)\
            .lte("created_at", end_date)\
            .execute()
        
        user_games = user_stats_res.data
        
        if not user_games:
            return {"has_data": False}

        # Calculate User Metrics
        total_games = len(user_games)
        total_score = sum(g['score'] for g in user_games)
        accuracies = [g['accuracy'] for g in user_games]
        avg_accuracy = statistics.mean(accuracies) if accuracies else 0
        best_accuracy = max(accuracies) if accuracies else 0
        best_streak = max((g['best_streak'] for g in user_games), default=0)
        top_score = max((g['score'] for g in user_games), default=0)

        # Active Day
        dates = [g['created_at'].split('T')[0] for g in user_games]
        day_counts = Counter(dates)
        most_active_day = day_counts.most_common(1)[0][0] if day_counts else None
        
        # Convert most_active_day to nicer format if possible
        if most_active_day:
             dt = datetime.strptime(most_active_day, "%Y-%m-%d")
             most_active_day = dt.strftime("%B %d")

        # Fetch Global Stats (Approximation: Last 2000 games to save DB load)
        global_stats_res = supabase.table("user_statistics")\
            .select("accuracy, user_id")\
            .order("created_at", desc=True)\
            .limit(2000)\
            .execute()
            
        global_games = global_stats_res.data
        
        # Compare
        global_accuracies = [g['accuracy'] for g in global_games]
        global_avg_accuracy = statistics.mean(global_accuracies) if global_accuracies else 0
        
        # Calculate percentiles
        better_than_accuracy = sum(1 for a in global_accuracies if avg_accuracy > a) / len(global_accuracies) * 100 if global_accuracies else 0
        
        # Global activity comparison
        user_game_counts = Counter(g['user_id'] for g in global_games)
        avg_games_per_user = statistics.mean(user_game_counts.values()) if user_game_counts else 0
        
        activity_percentile = 50 # Default
        if total_games > 0 and avg_games_per_user > 0:
            # Simple ratio for now as estimating percentile from partial data is hard
            ratio = total_games / avg_games_per_user
            if ratio > 2: activity_percentile = 95
            elif ratio > 1.5: activity_percentile = 80
            elif ratio > 1: activity_percentile = 60
            else: activity_percentile = 40

        return {
            "has_data": True,
            "year": current_year,
            "total_games": total_games,
            "total_score": total_score,
            "avg_accuracy": round(avg_accuracy, 2),
            "best_accuracy": round(best_accuracy, 2),
            "best_streak": best_streak,
            "top_score": top_score,
            "most_active_day": most_active_day,
            "global_avg_accuracy": round(global_avg_accuracy, 2),
            "accuracy_percentile": round(better_than_accuracy),
            "activity_percentile": activity_percentile
        }

    except Exception as e:
        print(f"Error generating wrapped: {e}")
        raise HTTPException(status_code=500, detail=str(e))
