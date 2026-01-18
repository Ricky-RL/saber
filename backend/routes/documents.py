from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase
from .jwt import verify_token
from pydantic import BaseModel

router = APIRouter(tags=["documents"])
from fastapi import UploadFile, File, Form
import shutil
import os

class UpdateTopicRequest(BaseModel):
    topic: str

@router.get("/recent-documents")
async def get_recent_documents(user = Depends(verify_token)):
    """
    Fetch the most recent documents for the authenticated user.
    """
    # user is a User object from supabase-py
    user_id = user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    try:
        # 1. Fetch recently uploaded documents
        uploads_response = supabase.table("documents") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(10) \
            .execute()
        
        recent_uploads = uploads_response.data

        # 2. Fetch recently played documents (via user_statistics)
        plays_response = supabase.table("user_statistics") \
            .select("created_at, document:documents(*)") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(10) \
            .execute()
            
        recent_plays = plays_response.data

        # Combine and process
        combined_docs = []
        
        # Add uploads
        for doc in recent_uploads:
            doc['last_interaction'] = doc['created_at']
            doc['interaction_type'] = 'uploaded'
            combined_docs.append(doc)

        # Add plays
        for play in recent_plays:
            if play.get('document'):
                doc = play['document']
                # Use the play time as the last interaction
                doc['last_interaction'] = play['created_at']
                doc['interaction_type'] = 'played'
                combined_docs.append(doc)

        # Sort by last_interaction descending
        combined_docs.sort(key=lambda x: x['last_interaction'], reverse=True)

        # Deduplicate by id
        seen_ids = set()
        unique_docs = []
        for doc in combined_docs:
            if doc['id'] not in seen_ids:
                seen_ids.add(doc['id'])
                unique_docs.append(doc)

        return unique_docs[:6] # Return top 6
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/explore")
async def explore_documents(query: str = None, user = Depends(verify_token)):
    """
    Fetch public documents for exploration.
    Excludes the current user's documents.
    Supports filtering by name or topic via 'query'.
    """
    user_id = user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    try:
        # Start base query
        # We need to filter where user_id != current_user
        # Supabase-py 'neq' fits this.
        db_query = supabase.table("documents").select("*").neq("user_id", user_id)

        if query:
            # Simple OR search on name and topic
            # Supabase 'or_' syntax: topic.ilike.%query%,name.ilike.%query%
            db_query = db_query.or_(f"name.ilike.%{query}%,topic.ilike.%{query}%")
        
        # Order by created_at desc
        db_query = db_query.order("created_at", desc=True).limit(50)
        
        response = db_query.execute()
        
        documents = response.data
        
        # Add random ratings for now provided by the user request
        # In a real app, this would query a ratings table
        import random
        for doc in documents:
            doc['rating'] = round(random.uniform(3.5, 5.0), 1)
            
        return documents

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/document/{document_id}")
def get_document(document_id: str):
    """
    Fetch a specific document by its ID, including a signed URL for the file.
    """
    try:
        response = supabase.table("documents").select("*").eq("id", document_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document = response.data
        
        # Generate signed URL for the file
        try:
            # Note: Supabase Python storage client uses from_ because from is reserved
            res = supabase.storage.from_("documents").create_signed_url(document["file_path"], 3600)
            
            # Extract URL from response (it can be a dict or string depending on version)
            # Typically returns {'signedURL': '...'}
            if isinstance(res, dict) and 'signedURL' in res:
                document['file_url'] = res['signedURL']
            elif isinstance(res, str):
                document['file_url'] = res
            else:
                # Try accessing attribute style if not dict
                if hasattr(res, 'signedURL'):
                     document['file_url'] = res.signedURL
                else: 
                     # Handle updated library return structure
                     # New supabase-py might return a string directly or different dict
                     document['file_url'] = res # Fallback
            
        except Exception as e:
            print(f"Error creating signed URL: {e}")
            document['file_url'] = None
            
        return document
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/document/{document_id}/topic")
def update_document_topic(document_id: str, request: UpdateTopicRequest):
    """
    Update the topic of a document.
    """
    try:
        response = supabase.table("documents") \
            .update({"topic": request.topic}) \
            .eq("id", document_id) \
            .execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/document")
async def save_document(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    topic: str = Form(None)
):
    """
    Upload a document to Supabase Storage and save metadata to the database.
    (Replaces previous JSON-based save_document)
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Generate a unique path
        file_ext = file.filename.split('.')[-1]
        file_name = f"{user_id}/{os.urandom(8).hex()}.{file_ext}"
        
        print(f"📤 Attempting to upload file: {file_name}")
        print(f"   File size: {len(file_content)} bytes")
        print(f"   Content type: {file.content_type}")
        
        # Upload to Supabase Storage
        try:
            upload_response = supabase.storage.from_("documents").upload(
                file_name,
                file_content,
                {"content-type": file.content_type}
            )
            
            print(f"✅ Storage upload response: {upload_response}")
            
            # Check for errors in different response formats
            if hasattr(upload_response, 'error') and upload_response.error:
                print(f"❌ Storage upload error (attribute): {upload_response.error}")
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {upload_response.error}")
            
            if isinstance(upload_response, dict) and 'error' in upload_response:
                print(f"❌ Storage upload error (dict): {upload_response['error']}")
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {upload_response['error']}")
                
            # VERIFICATION: Try to list files in the folder to see if it exists
            list_path = f"{user_id}"
            print(f"👀 Verifying upload by listing files in: {list_path}")
            files = supabase.storage.from_("documents").list(list_path)
            found = False
            for f in files:
                if f['name'] == file_name.split('/')[-1]:
                    found = True
                    print(f"✅ Found file in storage listing: {f['name']}")
                    break
            
            if not found:
                print(f"⚠️ WARNING: File uploaded but not found in listing! Path: {file_name}")
                print(f"   Files found in {list_path}: {[f['name'] for f in files]}")
                
        except Exception as storage_error:
            print(f"❌ Storage upload exception: {str(storage_error)}")
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(storage_error)}")
        
        # Insert into database
        response = supabase.table("documents").insert({
            "user_id": user_id,
            "name": file.filename,
            "file_path": file_name,
            "file_size": len(file_content),
            "file_type": file.content_type,
            "topic": topic,
            "processed": False,
            "questions": 0
        }).execute()
        
        print(f"✅ Database insert successful: {response.data[0]['id']}")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error in save_document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
