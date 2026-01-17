"""
Quiz generation route - handles PDF upload and quiz generation.
"""
import base64
import uuid
import json
import requests
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from config import OPENROUTER_API_KEY
from dotenv import load_dotenv
import os
load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


router = APIRouter(tags=["quiz"])

def encode_pdf_to_base64(pdf_bytes: bytes) -> str:
    """Encode PDF bytes to base64 data URI format."""
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")
    return f"data:application/pdf;base64,{encoded}"


def generate_quiz_from_pdf(document_id: str, pdf_base64: str) -> str:
    """
    Generate a quiz from a PDF document using OpenRouter/Gemini API.
    
    Args:
        document_id: Unique identifier for the document
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
- document_id, genre (1-2 words describing subject/topic), questions[]
- Each question: id, type ("mcq" or "true_false"), question, options (4 for mcq), correct_answer

CRITICAL WORD LIMIT: ALL answers and ALL options MUST be 1-4 words MAXIMUM. Count every word!
Bad: "Ensuring revisions don't inject faults" (6 words) → Use: "Prevent fault injection" (3 words)
Bad: "Return to former state" (4 words) → Use: "State regression" (2 words)
Bad: "Ranking tests by importance" (4 words) → Use: "Test prioritization" (2 words)
Use noun phrases only. Remove verbs, articles, prepositions. Maximum 4 words - if longer, shorten it!

Distribution: Balanced MCQ/true-false mix. At least 10 questions (more if content allows).
True/false: Use boolean true/false for correct_answer.

Document ID: {document_id}
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


@router.post("/generate-quiz")
async def generate_quiz(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    Generate a quiz from an uploaded PDF file.
    
    Accepts a PDF file and user_id, returns a JSON quiz with:
    - Balanced mix of multiple choice questions (4 options each) and true/false questions
    - At least 10 questions (more if content allows)
    - All answers are 1-4 words maximum to fit in game blocks
    - Genre/subject area (1-2 words)
    - User ID included in response
    """
    
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        pdf_bytes = await file.read()
        document_id = f"DOC_{uuid.uuid4().hex[:8]}"

        pdf_base64 = encode_pdf_to_base64(pdf_bytes)
        quiz_json_str = generate_quiz_from_pdf(document_id, pdf_base64)
        
        # Parse the JSON string to ensure it's valid before returning
        quiz_data = json.loads(quiz_json_str)
        
        # Add user_id to response (not passed to LLM)
        quiz_data["user_id"] = user_id
        
        return quiz_data
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse quiz response: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the file: {str(e)}"
        )
