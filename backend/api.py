from typing import List, Dict, Optional
from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import socketio
from agent import UrbanExplorerAgent
from websocket_manager import websocket_manager
from conversation_manager import get_conversation_manager
from database import init_database, get_db_manager

# Create FastAPI app
fastapi_app = FastAPI(title="UrbanExplorer API", version="1.0.0")

# Add CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Socket.IO ASGI app with FastAPI mounted on /map path
app = socketio.ASGIApp(websocket_manager.get_socketio_server(), fastapi_app, socketio_path='/map')


class ChatRequest(BaseModel):
    message: str
    conversation_id: str  # Always required - client generates UUID


@fastapi_app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    conversation_manager = get_conversation_manager()
    
    # Check if conversation exists, create if not
    if not conversation_manager.conversation_exists(request.conversation_id):
        # Create new conversation with client-provided ID
        conversation_manager.create_conversation_with_id(request.conversation_id, request.message)
        print(f"[DEBUG] Created new conversation: {request.conversation_id}")
    else:
        # Add user message to existing conversation
        conversation_manager.add_user_message(request.conversation_id, request.message)
        print(f"[DEBUG] Using existing conversation: {request.conversation_id}")
    
    def generate():
        # Create fresh agent for each request
        agent = UrbanExplorerAgent()
        for chunk in agent.run_stream(request.message, request.conversation_id):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@fastapi_app.get("/conversations/{conversation_id}")
async def get_conversation_map(conversation_id: str):
    db_manager = get_db_manager()
    
    # Get regions for this conversation
    regions = db_manager.get_conversation_regions(conversation_id)
    
    # Convert to dict format
    regions_data = [region.to_dict() for region in regions]
    
    # Send via websocket
    for region in regions_data:
        if region.get('coordinates'):
            await websocket_manager.broadcast_map_update(
                area_name=region['region_name'],
                coordinates=region['coordinates'],
                action="add"
            )
    
    return {"status": "sent", "conversation_id": conversation_id, "regions_count": len(regions_data)}

# Initialize database on startup
@fastapi_app.on_event("startup")
async def startup_event():
    print("🚀 Starting UrbanExplorer API...")
    init_database()
    print("✅ API startup complete")
