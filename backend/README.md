# UrbanExplorer Backend

Simple AI agent implementation using Anthropic's API to provide London neighborhood recommendations based on lifestyle preferences.

## Setup

1. Install dependencies:
   ```bash
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
- `POST /chat/stream` - Streaming chat response (Server-Sent Events)
- `POST /chat` - Non-streaming chat response
- `GET /health` - Health check
- `WebSocket /socket.io/` - Socket.IO for real-time map updates

#### Testing Map Updates with curl

**1. Test Agent with Area Recommendations:**
```bash
# Test streaming chat with area request
curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "I want a trendy area in London with good vibes"}'

# Test map update functionality (streaming)
curl -X POST "http://localhost:8000/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me Shoreditch on the map"}'

# Test non-streaming chat
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me Shoreditch on the map"}'
```

**2. Expected Behavior:**
- Agent will automatically call `get_coordinates_for_area()` for recommended areas
- Agent will then call `update_map()` to broadcast coordinates via WebSocket
- Debug output in server logs will show tool execution
- WebSocket clients (if connected) will receive map updates

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
   curl -X POST "http://localhost:8000/chat/stream" \
     -H "Content-Type: application/json" \
     -d '{"message": "Show me Shoreditch on the map"}'
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

- **Autonomous Agent**: Automatically calls tools when discussing London areas
- **Real-time Map Updates**: WebSocket broadcasting of area coordinates to frontend
- **Interactive Chat**: Both streaming and non-streaming endpoints
- **Tool Integration**: 
  - `get_coordinates_for_area` - Fetches London area boundaries
  - `update_map` - Broadcasts coordinates via WebSocket
  - `clear_map` - Clears all areas from map
  - `get_map_state` - Returns current map state
- **Socket.IO Support**: Real-time communication with frontend clients
- **System Prompt**: Loads from `../system-prompt.md`
- **Debug Logging**: Comprehensive tool execution tracking

## Architecture

```
User Request → Agent → Tool Calls → WebSocket Broadcast → Frontend Map Update
     ↓           ↓         ↓              ↓                    ↓
   Chat API → Claude 4.0 → Coordinates → Socket.IO → Real-time Visualization
```