# UrbanExplorer Backend

Simple AI agent implementation using Anthropic's API to provide London neighborhood recommendations based on lifestyle preferences.

## Setup

1. Install dependencies:
   ```bash
   cd backend
   uv sync
   ```

2. Create `.env` file with your Anthropic API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

## Usage

### CLI Mode
Run the interactive agent:
```bash
uv run python main.py
```

Type 'exit' or press Ctrl+C to quit.

### API Mode
Start the FastAPI server:
```bash
uv run uvicorn api:app --reload
```

The API will be available at `http://localhost:8000`

#### Endpoints
- `POST /chat/stream` - Streaming chat response (Server-Sent Events)
- `POST /chat` - Non-streaming chat response
- `GET /health` - Health check

#### Example Usage
```bash
# Streaming chat
curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "I want a trendy area in London and return me list of coordinates for it", "conversation_history": []}'

curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "I want a list of points of interests for this area_coordinates: [[-0.095,51.535],[-0.095,51.533],[-0.094,51.531],[-0.095,51.535]], and list of interests: [karaoke bars, boxing clubs, pizza places", "conversation_history": []}'
  
# Non-streaming chat
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "I want a trendy area in London", "conversation_history": []}'
```

## Features

- Interactive chat interface
- Loads system prompt from `../system-prompt.md`
- Maintains conversation history during session
- Raw request/response with minimal logging