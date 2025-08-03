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
    region_id: Optional[int] = None  # Optional region ID for POI requests


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
        for chunk in agent.run_stream(request.message, request.conversation_id, request.region_id):
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
    # Send all regions for this conversation via websocket
    result = await websocket_manager.broadcast_map_update(conversation_id)
    
    return {"status": "sent", "conversation_id": conversation_id, "regions_count": result.get('regions_count', 0)}

@fastapi_app.get("/conversations/{conversation_id}/regions/{region_id}")
async def get_region_map(conversation_id: str, region_id: int):
    # Create agent and trigger POI population for this region
    agent = UrbanExplorerAgent()
    print('inside get_region_map {conversation_id} {region_id}')
    # Run agent with region_id to automatically populate POIs
    response_text = ""
    for chunk in agent.run_stream("INTERNAL SYSTEM: Populate points of interest for this region. CALL ONLY get_regional_interests_for_area AND NOTHING ELSE", conversation_id, region_id):
        response_text += chunk
    
    # Send all regions for this conversation via websocket
    result = await websocket_manager.broadcast_map_update(conversation_id)
    
    return {"status": "sent", "conversation_id": conversation_id, "region_id": region_id, "regions_count": result.get('regions_count', 0)}

# Initialize database on startup
@fastapi_app.on_event("startup")
async def startup_event():
    print("🚀 Starting UrbanExplorer API...")
    init_database()
    print("✅ API startup complete")
