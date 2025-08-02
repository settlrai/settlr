from typing import List, Dict
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import UrbanExplorerAgent

app = FastAPI(title="UrbanExplorer API", version="1.0.0")

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = []  # Not used in autonomous agent

@app.post("/chat/stream")
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

@app.post("/chat")
async def chat(request: ChatRequest):
    # Create fresh agent for each request (like OpenAI agents pattern)
    agent = UrbanExplorerAgent()
    response = agent.run(request.message)
    return {"response": response}

@app.get("/health")
async def health():
    return {"status": "healthy"}