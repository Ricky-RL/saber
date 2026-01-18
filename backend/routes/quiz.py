"""
Quiz generation route - handles quiz generation from documents.
"""
import base64
import json
import requests
from fastapi import APIRouter, HTTPException
from config import OPENROUTER_API_KEY
from .documents import get_document, update_document_topic, UpdateTopicRequest
from dotenv import load_dotenv
import os
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
async def generate_quiz(document_id: str):
    """
    Generate a quiz from a document stored in Supabase.
    
    Fetches the document by document_id, downloads the PDF, and generates a quiz.
    Updates the document's topic with the generated genre.
    
    Returns a JSON quiz with:
    - Balanced mix of multiple choice questions (4 options each) and true/false questions
    - At least 10 questions (more if content allows)
    - All answers are 1-4 words maximum to fit in game blocks
    - Genre/subject area (1-2 words) - also updates the document's topic
    """
    
    try:
        # 1. Fetch document using the get_document endpoint
        document = get_document(document_id)
        
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
        
        # 5. Generate quiz
        quiz_json_str = generate_quiz_from_pdf(pdf_base64)
        
        # 6. Parse the JSON string
        quiz_data = json.loads(quiz_json_str)
        
        # 7. Update document topic with the genre from quiz response using update_document_topic endpoint
        if "genre" in quiz_data and quiz_data["genre"]:
            try:
                update_request = UpdateTopicRequest(topic=quiz_data["genre"])
                update_document_topic(document_id, update_request)
            except Exception as update_error:
                # Log error but don't fail the request
                print(f"Error updating topic for document {document_id}: {update_error}")
        
        # 8. Remove document_id from response (it's already stored)
        if "document_id" in quiz_data:
            del quiz_data["document_id"]
        
        return quiz_data
        
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the document: {str(e)}"
        )
