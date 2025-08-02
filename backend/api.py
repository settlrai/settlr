from typing import List, Dict
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import socketio
from agent import UrbanExplorerAgent
from websocket_manager import websocket_manager

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
    conversation_history: List[Dict[str, str]] = []


@fastapi_app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    def generate():
        # Create fresh agent for each request (like OpenAI agents pattern)
        agent = UrbanExplorerAgent()
        for chunk in agent.run_stream(request.message):
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


@fastapi_app.post("/chat")
async def chat(request: ChatRequest):
    # Create fresh agent for each request (like OpenAI agents pattern)
    agent = UrbanExplorerAgent()
    response = agent.run(request.message)
    return {"response": response}


@fastapi_app.get("/health")
async def health():
    return {"status": "healthy"}
