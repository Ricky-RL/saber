"""
Quiz generation route - handles quiz generation and music generation from documents.
"""
import base64
import json
import requests
import os
from fastapi import APIRouter, HTTPException, Query
from config import OPENROUTER_API_KEY
from .documents import get_document, update_document_topic, UpdateTopicRequest
from .lyra import generate_song_with_lyra, get_bpm_from_difficulty, Difficulty
from supabase_client import supabase
from dotenv import load_dotenv
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


router = APIRouter(tags=["quiz"])

def encode_pdf_to_base64(pdf_bytes: bytes) -> str:
    """Encode PDF bytes to base64 data URI format."""
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")
    return f"data:application/pdf;base64,{encoded}"


def generate_quiz_from_pdf(pdf_base64: str) -> str:
    """
    Generate a quiz from a PDF document using OpenRouter/Gemini API.
    
    Args:
        pdf_base64: Base64-encoded PDF data URI
        
    Returns:
        JSON string containing the generated quiz
        
    Raises:
        requests.exceptions.RequestException: If API call fails
    """
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "Rhythm Quiz Game Backend",
    }

    payload = {
        "model": "google/gemini-2.5-flash-lite",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a quiz generation engine. "
                    "You must output ONLY valid JSON. "
                    "No markdown. No explanations. No extra text. "
                    "CRITICAL: All answers and ALL options MUST be 1-4 words MAXIMUM. "
                    "Count every single word - answers longer than 4 words will break the game! "
                    "Use noun phrases only, remove verbs and filler words."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"""
Generate a quiz from the uploaded document.

JSON Format:
- genre (1-2 words describing subject/topic), questions[]
- Each question: id, type ("mcq" or "true_false"), question, options (4 for mcq), correct_answer

CRITICAL WORD LIMIT: ALL answers and ALL options MUST be 1-4 words MAXIMUM. Count every word!
Bad: "Ensuring revisions don't inject faults" (6 words) → Use: "Prevent fault injection" (3 words)
Bad: "Return to former state" (4 words) → Use: "State regression" (2 words)
Bad: "Ranking tests by importance" (4 words) → Use: "Test prioritization" (2 words)
Use noun phrases only. Remove verbs, articles, prepositions. Maximum 4 words - if longer, shorten it!

Distribution: Balanced MCQ/true-false mix. At least 10 questions (more if content allows).
True/false: Use boolean true/false for correct_answer.
""",
                    },
                    {
                        "type": "file",
                        "file": {
                            "filename": "document.pdf",
                            "file_data": pdf_base64,
                        },
                    },
                ],
            },
        ],
        "plugins": [
            {
                "id": "file-parser",
                "pdf": {
                    "engine": "pdf-text"  # free + ideal for text-based notes
                },
            }
        ],
        "temperature": 0.4,
        "response_format": {
            "type": "json_object"
        },
    }

    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()

    # IMPORTANT: content is returned as a JSON string
    return response.json()["choices"][0]["message"]["content"]


@router.post("/generate-quiz/{document_id}")
async def generate_quiz(document_id: str, difficulty: str = Query("easy", description="Game difficulty: easy, medium, or hard")):
    """
    Generate a quiz and music for a document stored in Supabase.
    
    Fetches the document by document_id, downloads the PDF, generates a quiz and music.
    Stores both quiz (JSON) and music (file) in Supabase, and updates the document.
    
    Parameters:
    - document_id: UUID of the document
    - difficulty: Game difficulty level (easy, medium, hard) - defaults to medium
    
    Returns a JSON response with:
    - quiz: Quiz data with questions
    - music_data: Base64-encoded music file (for immediate use in game)
    - music_file_path: Path to stored music file in Supabase
    
    The quiz is stored in the documents table's 'quiz' column (JSONB).
    The music file is stored in Supabase storage and path is saved in 'music_file_path'.
    """
    
    try:
        # 1. Fetch document using the get_document endpoint
        document = get_document(document_id)
        user_id = document.get("user_id")
        
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="Document missing user_id"
            )
        
        # 2. Get signed URL for the PDF file (from document response)
        file_url = document.get("file_url")
        if not file_url:
            raise HTTPException(
                status_code=500, 
                detail="Failed to get signed URL for document"
            )
        
        # 3. Download PDF from signed URL
        pdf_response = requests.get(file_url, timeout=30)
        pdf_response.raise_for_status()
        pdf_bytes = pdf_response.content
        
        # 4. Encode PDF to base64
        pdf_base64 = encode_pdf_to_base64(pdf_bytes)
        
        # 5. Generate quiz and music in parallel for efficiency
        import asyncio
        
        # OPTIMIZATION: Generate quiz and music in parallel (they don't depend on each other)
        difficulty_enum = Difficulty(difficulty.lower())
        bpm = get_bpm_from_difficulty(difficulty_enum)
        
        print(f"🚀 Starting parallel generation: quiz + music (BPM: {bpm})")
        
        # Run quiz and music generation concurrently
        # Quiz generation is synchronous, so wrap it in a thread
        quiz_task = asyncio.to_thread(generate_quiz_from_pdf, pdf_base64)
        music_task = generate_song_with_lyra(bpm)
        
        # Wait for both to complete in parallel
        quiz_json_str, music_bytes = await asyncio.gather(quiz_task, music_task)
        
        print(f"✅ Both quiz and music generation completed")
        
        # Parse quiz JSON
        quiz_data = json.loads(quiz_json_str)
        
        # 6. Store quiz and difficulty in Supabase (update documents table)
        # Remove document_id from quiz_data if present (it's already stored)
        if "document_id" in quiz_data:
            del quiz_data["document_id"]
        
        # Update document with quiz JSON and difficulty
        quiz_update_response = supabase.table("documents").update({
            "quiz": quiz_data,
            "difficulty": difficulty.lower()  # Store difficulty (easy, medium, hard)
        }).eq("id", document_id).execute()
        
        if not quiz_update_response.data:
            print(f"Warning: Failed to update quiz and difficulty for document {document_id}")
        
        # 7. Store music file in Supabase storage
        # Generate unique filename for music
        music_file_name = f"{user_id}/music_{document_id}_{os.urandom(4).hex()}.wav"
        
        try:
            # Upload music to Supabase Storage (using documents bucket for now)
            upload_response = supabase.storage.from_("documents").upload(
                music_file_name,
                music_bytes,
                {"content-type": "audio/wav"}
            )
            
            # Check for errors
            if hasattr(upload_response, 'error') and upload_response.error:
                raise Exception(f"Storage upload error: {upload_response.error}")
            if isinstance(upload_response, dict) and 'error' in upload_response:
                raise Exception(f"Storage upload error: {upload_response['error']}")
            
            # Update document with music_file_path
            music_update_response = supabase.table("documents").update({
                "music_file_path": music_file_name
            }).eq("id", document_id).execute()
            
            if not music_update_response.data:
                print(f"Warning: Failed to update music_file_path for document {document_id}")
                
        except Exception as music_storage_error:
            print(f"Error storing music file: {music_storage_error}")
            # Don't fail the request if music storage fails - we still return the music data
            music_file_name = None
        
        # 8. Update document topic with the genre from quiz response
        if "genre" in quiz_data and quiz_data["genre"]:
            try:
                update_request = UpdateTopicRequest(topic=quiz_data["genre"])
                update_document_topic(document_id, update_request)
            except Exception as update_error:
                # Log error but don't fail the request
                print(f"Error updating topic for document {document_id}: {update_error}")
        
        # 9. Return quiz data and music data (base64 encoded for frontend)
        music_base64 = base64.b64encode(music_bytes).decode("utf-8")
        
        return {
            "quiz": quiz_data,
            "music_data": music_base64,  # Base64-encoded WAV file for immediate use
            "music_file_path": music_file_name,  # Path in Supabase storage
            "difficulty": difficulty,
            "document_id": document_id
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse quiz response: {str(e)}"
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error downloading document: {str(e)}"
        )
    except ValueError as e:
        # Invalid difficulty enum
        print(f"❌ ValueError in generate_quiz: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid difficulty: {str(e)}"
        )
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_traceback = traceback.format_exc()
        print(f"❌ Error in generate_quiz endpoint:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print(f"Traceback:\n{error_traceback}")
        
        # Provide more specific error message
        error_detail = str(e)
        if "lyra" in error_detail.lower() or "vertex" in error_detail.lower() or "google" in error_detail.lower():
            error_detail = f"Music generation failed: {error_detail}"
        elif "quiz" in error_detail.lower() or "openrouter" in error_detail.lower() or "gemini" in error_detail.lower():
            error_detail = f"Quiz generation failed: {error_detail}"
        elif "supabase" in error_detail.lower() or "storage" in error_detail.lower():
            error_detail = f"Storage error: {error_detail}"
        else:
            error_detail = f"An error occurred while processing the document: {error_detail}"
        
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )
