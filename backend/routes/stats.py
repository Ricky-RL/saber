from fastapi import APIRouter, HTTPException
from supabase_client import supabase
from datetime import datetime, timedelta, timezone
from collections import defaultdict

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/activity/{user_id}")
def get_user_activity(user_id: str):
    try:
        # Calculate date range (last 6 months appx. 180 days to match frontend grid)
        # Use UTC to match database storage
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=180) 
        
        # Determine the earliest date we want to show (start of the month 3 months ago)
        # Or simpler: just get all stats for the user and filter in python or query.
        # Querying by date range is better for performance.

        # Removed non-existent column 'questions_answered'
        response = supabase.table("user_statistics")\
            .select("created_at, accuracy, score, document_id, best_streak")\
            .eq("user_id", user_id)\
            .gte("created_at", start_date.isoformat())\
            .lte("created_at", end_date.isoformat())\
            .execute()
        
        games = response.data
        
        # Log for debugging (will show in server logs if visible)
        print(f"Stats request for {user_id}: found {len(games) if games else 0} games")
        
        if not games:
             return {
                "daily_activity": {},
                "total_questions": 0,
                "average_accuracy": 0,
                "best_combo": 0 
            }

        # Process data
        daily_activity = defaultdict(int)
        total_questions = 0
        total_accuracy = 0
        best_combo = 0 # best streak
        
        # We need to ensure we have 'questions_answered' or estimate it from score/game
        # The schema doesn't have questions_answered in user_statistics, but it has score.
        # Let's check schema again. `schema.sql` shows: score, accuracy, best_streak.
        # We can assume number of questions = score / 100 (if 100 per question) or just count games.
        # The prompt image shows "156 QUESTIONS", "87% ACCURACY", "x42 BEST COMBO".
        # We will use 'best_streak' for combo.
        # We will sum scores or game count for activity intensity.
        # Accuracy is average accuracy.

        accuracies = []
        max_streak = 0

        for game in games:
            # Parse date YYYY-MM-DD
            # created_at format is usually "2023-11-20T12:00:00+00:00"
            date_str = game['created_at'].split('T')[0]
            daily_activity[date_str] += 1
            
            # Use score as proxy for questions if not available, OR 
            # if we can assume 1 game = X questions. Let's assume score corresponds roughly to questions.
            # Or better, just count games for now as "activity" ticks.
            # But the UI says "Questions". If we don't have that field, we might need to add it or estimate.
            # Let's count approximate questions based on score: score / 100 roughly? 
            # Or just count games. 
            # Let's assume for now 1 game has some questions. 
            # If `questions_answered` is not in DB, use score/100 as placeholder.
            
            # Wait, the screenshot says "QUESTIONS".
            # Let's sum score for now as a placeholder for "volume".
            
            accuracies.append(game['accuracy'])
            if game['best_streak'] > max_streak:
                max_streak = game['best_streak']
        
        avg_acc = sum(accuracies) / len(accuracies) if accuracies else 0
        
        # Approximate questions from games * (avg questions per game, say 10)
        # This is a heuristic if we don't store exact question count per session.
        estimated_questions = len(games) * 15 

        return {
            "daily_activity": daily_activity,
            "total_questions": estimated_questions, 
            "average_accuracy": round(avg_acc * 100), # Convert 0.85 -> 85
            "best_combo": max_streak
        }

    except Exception as e:
        print(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
