from typing import List, Dict
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import UrbanExplorer

app = FastAPI(title="UrbanExplorer API", version="1.0.0")

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = []

agent = UrbanExplorer()

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    def generate():
        for chunk in agent.chat_stream(request.message, request.conversation_history):
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

@app.post("/chat")
async def chat(request: ChatRequest):
    response = agent.chat(request.message, request.conversation_history)
    return {"response": response}

@app.get("/health")
async def health():
    return {"status": "healthy"}