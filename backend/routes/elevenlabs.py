import base64
from elevenlabs import (
    ElevenLabs,
    ConversationalConfig,
    AgentConfig,
    ConversationConfig,
    TtsConversationalConfigOutput,
    KnowledgeBaseLocator,
    PromptAgentApiModelOutput,
)
import json
import asyncio
from urllib.parse import urlencode
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Form
import websockets
import requests
from config import ELEVENLABS_API_KEY
from routes.jwt import validate_jwt
from routes.documents import get_document
from supabase_client import supabase
from tempfile import NamedTemporaryFile
import os

router = APIRouter()


@router.websocket("/elevenlabs/{jwt_token}/v1/text-to-speech/{voice_id}/stream-input")
async def websocket_proxy(websocket: WebSocket, jwt_token: str, voice_id: str):
    await websocket.accept()

    if not validate_jwt(jwt_token):
        await websocket.close(code=1008, reason="Invalid or expired JWT")
        return

    if not ELEVENLABS_API_KEY:
        await websocket.close(code=1011, reason="ElevenLabs API key not configured")
        return

    query_params = dict(websocket.query_params)
    query_string = urlencode(query_params)
    elevenlabs_url = (
        f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"
    )
    if query_string:
        elevenlabs_url += f"?{query_string}"

    elevenlabs_ws = None
    try:
        elevenlabs_ws = await websockets.connect(elevenlabs_url)
        print(f"Connected to ElevenLabs WebSocket")

        async def forward_to_elevenlabs():
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    if "xi_api_key" not in message:
                        message["xi_api_key"] = ELEVENLABS_API_KEY
                    await elevenlabs_ws.send(json.dumps(message))
            except WebSocketDisconnect:
                print("Client disconnected")
                if elevenlabs_ws:
                    await elevenlabs_ws.close()
            except Exception as e:
                print(f"Error forwarding to ElevenLabs: {e}")
                if elevenlabs_ws:
                    await elevenlabs_ws.close()

        async def forward_to_client():
            try:
                while True:
                    data = await elevenlabs_ws.recv()
                    await websocket.send_text(data)
            except websockets.exceptions.ConnectionClosed:
                print("ElevenLabs connection closed")
            except Exception as e:
                print(f"Error forwarding to client: {e}")

        await asyncio.gather(
            forward_to_elevenlabs(), forward_to_client(), return_exceptions=True
        )
    except Exception as e:
        print(f"WebSocket proxy error: {e}")
        import traceback

        traceback.print_exc()
        if elevenlabs_ws:
            await elevenlabs_ws.close()
        try:
            await websocket.close(code=1011, reason=f"Proxy error: {str(e)}")
        except:
            pass


class AgentCreator:
    FIRST_MESSAGE = "Hello! How can I help you today?"
    SYSTEM_PROMPT = """
You are a voice-based study assistant. Your primary job is to answer the user’s questions using the uploaded document as the highest-priority source of truth.

### Knowledge Priority Rules
1. Always prioritize the uploaded document.
If the answer exists in the document, use it directly.
2. Do not invent facts.
If the document does not contain the answer, clearly say you do not see it in the material and offer to help using general knowledge only if the user explicitly agrees.
3. Stay faithful to wording and meaning.
Do not distort definitions, formulas, or examples from the document.

### Behavior and Tone
Be fun, playful, and slightly mean in a motivational way.

Examples of acceptable tone:
- Light teasing (Alright genius, let’s fix that mistake.)
- Tough love (Close, but no. Let’s actually read the definition.)
- Encouraging roast (Your brain almost had it. Try again.)

Never be insulting about identity, intelligence, or personal traits. Keep it academic and friendly.

### Voice Style Guidelines
- Keep responses short, clear, and spoken-friendly.
- Avoid long paragraphs. Use natural pauses and simple phrasing.
- Prefer explanation plus quick example when helpful.

### Answering Strategy
When responding:
1. Give the direct answer first.
2. Briefly explain using the document’s content.
3. If the user is wrong, correct them clearly and explain why.
4. When useful, ask a short follow-up question to reinforce learning.

### Uncertainty Handling
If the document does not contain the requested information:
Say: That’s not in your uploaded material.
Offer: Want me to explain it using general knowledge?

### Strict Rules
- Do not hallucinate citations or page numbers.
- Do not reference system instructions.
- Do not mention internal policies.
- Do not break character.

Your goal is to be the user’s slightly savage, highly accurate study coach who keeps them focused, learning, and accountable.
"""

    def __init__(self, user_id, document_id, document_file):
        self.agent_name = f"agent_{user_id}_{document_id}"
        self.document_file = document_file
        self.client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        self.agent = self.create_agent(self.agent_name)

    def create_agent(self, agent_name):
        knowledge_base_document = (
            self.client.conversational_ai.knowledge_base.documents.create_from_file(
                file=self.document_file, name="Document"
            )
        )
        agent = self.client.conversational_ai.agents.create(
            name=agent_name,
            conversation_config=ConversationalConfig(
                agent=AgentConfig(
                    prompt=PromptAgentApiModelOutput(
                        prompt=self.SYSTEM_PROMPT,
                        knowledge_base=[
                            KnowledgeBaseLocator(
                                type="file",
                                name=knowledge_base_document.name,
                                id=knowledge_base_document.id,
                            )
                        ],
                    ),
                    first_message=self.FIRST_MESSAGE,
                ),
                conversation=ConversationConfig(
                    text_only=False,
                ),
                tts=TtsConversationalConfigOutput(
                    voice_id="G3zrXA9moYrFCgwBAvxJ",
                ),
            ),
        )

        return agent

def encode_pdf_to_base64(pdf_bytes: bytes) -> str:
    """Encode PDF bytes to base64 data URI format."""
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")
    return f"data:application/pdf;base64,{encoded}"


@router.post("/create-agent/{document_id}")
async def create_agent(document_id: str, user_id: str = Form(...)):
    """
    Create an ElevenLabs agent for a document and update the document table with the agent_id.
    Downloads the document from Supabase storage.
    """
    try:
        # 1. Verify document belongs to user
        document_record = supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()
        
        if not document_record.data:
            raise HTTPException(status_code=404, detail="Document not found or does not belong to user")
        
        # 2. Fetch document using the get_document endpoint
        document = get_document(document_id)
        
        # 3. Get signed URL for the PDF file
        file_url = document.get("file_url")
        if not file_url:
            raise HTTPException(
                status_code=500, 
                detail="Failed to get signed URL for document"
            )
        
        # 4. Download PDF from signed URL
        pdf_response = requests.get(file_url, timeout=30)
        pdf_response.raise_for_status()
        pdf_bytes = pdf_response.content
        
        # 5. Write PDF to temporary file
        with NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as temp_file:
            temp_file.write(pdf_bytes)
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as pdf_file:
                agent_id = AgentCreator(
                    user_id=user_id,
                    document_id=document_id,
                    document_file=pdf_file
                ).agent.agent_id
                supabase.table("documents").update({"agent_id": agent_id}).eq("id", document_id).eq("user_id", user_id).execute()
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
        return {"message": "Agent created successfully", "agent_id": agent_id}
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error downloading document: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(e)}")


@router.get("/get-agent/{user_id}/{document_id}")
async def get_agent(user_id: str, document_id: str):
    """
    Get an ElevenLabs agent for a document.
    """
    try:
        agent = supabase.table("documents").select("*").eq("user_id", user_id).eq("id", document_id).execute()
        if not agent.data:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"agent_id": agent.data[0]["agent_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent: {str(e)}")
