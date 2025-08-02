# UrbanExplorer Backend

Simple AI agent implementation using Anthropic's API to provide London neighborhood recommendations based on lifestyle preferences.

## Setup

1. Install dependencies:
   ```bash
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
  -d '{"message": "I want a trendy area in London", "conversation_history": []}'

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