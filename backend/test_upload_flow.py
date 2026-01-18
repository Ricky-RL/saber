"""
Test script that:
1. Uploads a PDF to Supabase storage
2. Generates a quiz using the /generate-quiz/{document_id} endpoint
3. Creates an agent using the /create-agent/{document_id} endpoint

Usage: python test_upload_flow.py <path_to_pdf> <user_id>
"""

import sys
import requests
import random
from supabase_client import supabase

BASE_URL = "http://localhost:8000"


def upload_to_supabase(pdf_path: str, user_id: str) -> dict:
    """Upload PDF to Supabase storage and insert document record."""
    with open(pdf_path, "rb") as f:
        file_content = f.read()
    
    file_name = pdf_path.split("/")[-1]
    file_ext = file_name.split(".")[-1]
    storage_path = f"{user_id}/{random.random()}.{file_ext}"
    
    # Upload to storage
    supabase.storage.from_("documents").upload(storage_path, file_content)
    
    # Insert document record
    doc_name = file_name.rsplit(".", 1)[0]
    result = supabase.table("documents").insert({
        "user_id": user_id,
        "name": doc_name + f"_{random.random()}",
        "file_path": storage_path,
        "file_type": "application/pdf",
        "file_size": len(file_content),
        "processed": False,
        "questions": 0
    }).execute()
    
    return result.data[0]


def generate_quiz(document_id: str) -> dict:
    """Call /generate-quiz/{document_id} endpoint."""
    response = requests.post(f"{BASE_URL}/generate-quiz/{document_id}")
    
    if not response.ok:
        print(f"Error {response.status_code}: {response.text}")
        response.raise_for_status()
    return response.json()


def create_agent(document_id: str, user_id: str) -> dict:
    """Call /create-agent/{document_id} endpoint."""
    data = {"user_id": user_id}
    response = requests.post(f"{BASE_URL}/create-agent/{document_id}", data=data)
    
    if not response.ok:
        print(f"Error {response.status_code}: {response.text}")
        response.raise_for_status()
    return response.json()


def is_valid_uuid(val: str) -> bool:
    import re
    return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', val.lower()))


def main():
    if len(sys.argv) < 3:
        print("Usage: python test_upload_flow.py <path_to_pdf> <user_id>")
        print("\nuser_id must be a UUID from Supabase Auth > Users")
        print("Example: python test_upload_flow.py doc.pdf a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    user_id = sys.argv[2]
    
    if not is_valid_uuid(user_id):
        print(f"Error: '{user_id}' is not a valid UUID")
        print("\nGet your user_id from Supabase dashboard: Authentication > Users")
        print("It should look like: a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        sys.exit(1)
    
    print(f"User ID: {user_id}")
    
    # 1. Upload to Supabase
    print("\n1. Uploading to Supabase...")
    doc = upload_to_supabase(pdf_path, user_id)
    print(f"Document created: {doc}")
    
    # 2. Generate quiz
    print("\n2. Generating quiz...")
    quiz = generate_quiz(doc["id"])
    print(f"Quiz generated: {quiz}")
    
    # 3. Create agent
    print("\n3. Creating agent...")
    agent = create_agent(doc["id"], user_id)
    print(f"Agent created: {agent}")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
