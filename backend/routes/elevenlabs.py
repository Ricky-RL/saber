import json
import asyncio
from urllib.parse import urlencode
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets
from config import ELEVENLABS_API_KEY
from routes.jwt import validate_jwt

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
    elevenlabs_url = f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"
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
            forward_to_elevenlabs(),
            forward_to_client(),
            return_exceptions=True
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
