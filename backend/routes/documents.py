from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase
from .jwt import verify_token
from pydantic import BaseModel

router = APIRouter(tags=["documents"])

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

class SaveDocumentRequest(BaseModel):
    user_id: str
    filename: str
    file_path: str
    size: int
    topic: str | None = None

@router.post("/document")
async def save_document(request: SaveDocumentRequest):
    """
    Save a document to the database.
    """
    try:
        response = supabase.table("documents").insert({
            "user_id": request.user_id,
            "filename": request.filename,
            "file_path": request.file_path,
            "size": request.size,
            "topic": request.topic
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
