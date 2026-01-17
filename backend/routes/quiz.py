"""
Quiz generation route - handles PDF upload and quiz generation.
"""
import base64
import uuid
import json
import requests
from fastapi import APIRouter, UploadFile, File, HTTPException
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
                    "No markdown. No explanations. No extra text."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"""
Generate a quiz from the uploaded document.

CRITICAL RULES:
- Output must be STRICT valid JSON
- Top-level fields:
  - document_id
  - questions
- Each question must include:
  - id
  - type ("mcq" or "true_false")
  - question
  - options (ONLY for mcq, exactly 4 strings)
  - correct_answer

ANSWER LENGTH RESTRICTIONS (VERY IMPORTANT):
- ALL answers (correct_answer and all options) MUST be 1-4 words maximum
- Answers must be SHORT and fit in small blocks
- Examples of good answers: "Regression testing", "Test selection", "True", "All types"
- Examples of BAD answers: "To ensure that recent code revisions have not introduced new faults" (too long!)
- Keep options concise - they also need to fit in blocks

QUESTION DISTRIBUTION:
- Aim for a balanced mix of MCQ and true/false questions (approximately equal distribution)
- Generate at least 10 questions, but can generate more if content allows
- If you run out of meaningful content, stop (no minimum requirement)
- Make questions clear, concise, and directly related to the document content

OTHER RULES:
- True/False questions must use boolean true/false for correct_answer
- Do NOT include explanations
- Questions should be clear and test understanding of key concepts

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
async def generate_quiz(file: UploadFile = File(...)):
    """
    Generate a quiz from an uploaded PDF file.
    
    Accepts a PDF file and returns a JSON quiz with:
    - Balanced mix of multiple choice questions (4 options each) and true/false questions
    - At least 10 questions (more if content allows)
    - All answers are 1-4 words maximum to fit in game blocks
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
