# UrbanExplorer Backend

Simple AI agent implementation using Anthropic's API to provide London neighborhood recommendations based on lifestyle preferences.

## Setup

1. Install dependencies:

   ```bash
   cd backend
   uv sync
   ```

   If you encounter Socket.IO compatibility issues, update dependencies:

   ```bash
   uv sync --upgrade
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

Start the FastAPI server with WebSocket support:

```bash
uv run uvicorn api:app --reload
```

The API will be available at `http://localhost:8000`

#### Endpoints

**Chat Endpoints:**
- `POST /chat/stream` - Streaming chat (requires conversation_id from client)
- `POST /chat` - Non-streaming chat (requires conversation_id from client)

**Conversation Management:**
- `GET /conversations/{conversation_id}` - Get conversation details and message history

**System:**
- `GET /health` - Health check
- `WebSocket /map/socket.io/` - Socket.IO for real-time map updates

#### Request/Response Format

**Chat Request:**
```json
{
  "message": "Show me trendy areas in London",
  "conversation_id": "client-generated-uuid-123"
}
```

**Chat Response:**
```json
{
  "response": "Assistant response text",
  "conversation_id": "client-generated-uuid-123",
  "message_count": 4
}
```

#### Testing with curl

**1. Test Conversation Management:**
```bash
# Generate a conversation ID (client-side responsibility)
CONVERSATION_ID=$(uuidgen)

# Start new conversation with streaming
curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Show me trendy areas in London\", \"conversation_id\": \"$CONVERSATION_ID\"}"

# Continue existing conversation
curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Tell me more about Shoreditch\", \"conversation_id\": \"$CONVERSATION_ID\"}"

# Non-streaming conversation
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Show me Shoreditch on the map\", \"conversation_id\": \"$CONVERSATION_ID\"}"

# Get conversation history
curl -X GET "http://localhost:8000/conversations/$CONVERSATION_ID"
```

**2. Expected Behavior:**
- **Client-Driven Conversations**: Client generates UUID and sends with each request
- **Auto-Creation**: New conversations created when conversation_id doesn't exist in database
- **Context Preservation**: Agent has full conversation history for each request
- **Tool Execution**: Agent calls tools automatically (coordinates, map updates, etc.)
- **WebSocket Updates**: Map updates broadcast to connected clients

**3. Debug Output to Look For:**
```
[DEBUG] Found X tool calls
[DEBUG] Executing tool: get_coordinates_for_area with input: {'area_name': 'Shoreditch'}
[DEBUG] Tool result: [[-0.0781, 51.5265], [-0.0745, 51.5285]...]
[DEBUG] Executing tool: update_map with input: {'area_name': 'Shoreditch', 'coordinates': '...'}
```

**4. WebSocket Testing:**

**Note:** Raw WebSocket clients like wscat cannot connect to Socket.IO servers due to the handshake protocol.

**Socket.IO Client Testing:**
```bash
# Run the test client (dependencies already in pyproject.toml)
uv run python test_socket_client.py
```

**Testing Flow:**
1. **Terminal 1** - Start backend server:
   ```bash
   uv run uvicorn api:app --reload
   ```

2. **Terminal 2** - Run Socket.IO client:
   ```bash
   uv run python test_socket_client.py
   ```

3. **Terminal 3** - Trigger map updates:
   ```bash
   CONVERSATION_ID=$(uuidgen)
   curl -X POST "http://localhost:8000/chat/stream" \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"Show me Shoreditch on the map\", \"conversation_id\": \"$CONVERSATION_ID\"}"
   ```

4. **Watch Terminal 2** for real-time map update events

**Expected Output in Socket.IO Client:**
```
🗺️  Map Update Received:
   Area: Shoreditch
   Action: add
   Coordinates: 12 points
   Timestamp: 1704067200.123
```

## Features

- **Stateful Conversations**: SQLite database stores conversation history with client-driven UUIDs
- **Claude.ai-style Workflow**: Client generates conversation_id, backend creates if doesn't exist
- **Context Preservation**: Agent maintains full conversation context across requests
- **Autonomous Agent**: Automatically calls tools when discussing London areas
- **Real-time Map Updates**: WebSocket broadcasting of area coordinates to frontend
- **Interactive Chat**: Both streaming and non-streaming endpoints
- **Tool Integration**: 
  - `get_coordinates_for_area` - Fetches London area boundaries
  - `update_map` - Broadcasts coordinates via WebSocket
  - `clear_map` - Clears all areas from map
  - `get_map_state` - Returns current map state
  - `get_regional_interests_for_area` - Gets points of interest for areas
- **Socket.IO Support**: Real-time communication with frontend clients
- **Database Management**: SQLAlchemy with SQLite for conversation persistence
- **System Prompt**: Loads from `../system-prompt.md`
- **Debug Logging**: Comprehensive tool execution tracking

## Architecture

```
Client UUID → Conversation Manager → Agent → Tool Calls → Database Save
     ↓               ↓                  ↓         ↓             ↓
   Chat API → SQLite Database → Claude 4.0 → WebSocket → Real-time Map Updates
     ↓               ↓                  ↓         ↓             ↓
Auto-Creation → Message History → Context → Socket.IO → Frontend Visualization
```

## Database Schema

**conversations**
- id (TEXT PRIMARY KEY) - Client-generated UUID
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)  
- title (TEXT) - Auto-generated from first message
- meta_data (TEXT/JSON)

**messages**
- id (INTEGER PRIMARY KEY)
- conversation_id (TEXT FK)
- role (TEXT: 'user'/'assistant')
- content (TEXT)
- tool_calls (TEXT/JSON)
- timestamp (TIMESTAMP)