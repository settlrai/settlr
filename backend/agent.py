import os
import json
from pathlib import Path
from typing import Generator, List, Dict, Any, Callable
import anthropic
from anthropic.types import Message
from dotenv import load_dotenv
from coordinates_tool import get_area_coordinates
from map_update_tool import update_map, clear_map, get_map_state
from regional_interests_tool import get_regional_interests

class UrbanExplorerAgent:
    def __init__(self):
        load_dotenv()
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.name = "UrbanExplorer"
        self.instructions = self._load_instructions()
        self.tools = self._define_tools()
        self.model = "claude-sonnet-4-20250514"  # Claude 4.0
        
    def _load_instructions(self) -> str:
        prompt_path = Path(__file__).parent.parent / "system-prompt.md"
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _define_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "get_coordinates_for_area",
                "description": "Get boundary coordinates for a London area/neighborhood. Returns coordinate array for polygon rendering on maps.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "area_name": {
                            "type": "string",
                            "description": "Name of the London area (e.g., 'Shoreditch', 'Camden', 'King's Cross')"
                        }
                    },
                    "required": ["area_name"]
                }
            },
            {
                "name": "update_map",
                "description": "Update the frontend map with area coordinates via websocket. Automatically broadcasts to connected clients for real-time visualization.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "area_name": {
                            "type": "string",
                            "description": "Name of the London area/neighborhood"
                        },
                        "coordinates": {
                            "type": "string",
                            "description": "Coordinate array as string in format '[[lng,lat],[lng,lat],...]'"
                        },
                        "action": {
                            "type": "string",
                            "description": "Action type: 'add' (default), 'remove', 'clear', 'highlight'",
                            "enum": ["add", "remove", "clear", "highlight"]
                        }
                    },
                    "required": ["area_name", "coordinates"]
                }
            },
            {
                "name": "clear_map",
                "description": "Clear all areas from the map display.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_map_state",
                "description": "Get current map state information including connected clients and displayed areas.",
                "input_schema": {
                    "type": "object", 
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_regional_interests_for_area",
                "description": "Get points of interest for a specific area based on user interests. Searches for venues and places within the given area boundaries.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "area_coordinates": {
                            "type": "string",
                            "description": "Coordinates of the London area (e.g., \"[[-0.095,51.535],[-0.095,51.533],[-0.094,51.531],[-0.095,51.535]]\")"
                        },
                         "interests": {
                            "type": "string",
                            "description": "list of interests (e.g \"[karaoke bars, boxing clubs, pizza places]\")"
                        }
                    },
                    "required": ["area_coordinates", "interests"]
                }
            }
        ]
    
    def _get_tool_function(self, tool_name: str) -> Callable:
        """Get the actual function for a tool name."""
        tool_functions = {
            "get_coordinates_for_area": get_area_coordinates,
            "update_map": update_map,
            "clear_map": clear_map,
            "get_map_state": get_map_state,
            "get_regional_interests_for_area": get_regional_interests
        }
        return tool_functions.get(tool_name)
    
    def run(self, user_message: str) -> str:
        """Run the agent with a user message. Handles tool calling automatically."""
        messages = [{"role": "user", "content": user_message}]
        
        try:
            while True:
                print(f"[DEBUG] Sending to Claude with {len(messages)} messages")
                
                # Get response from Claude
                response: Message = self.client.messages.create(
                    model=self.model,
                    max_tokens=2000,
                    system=self.instructions,
                    messages=messages,
                    tools=self.tools
                )
                
                print(f"[DEBUG] Got response with {len(response.content)} content blocks")
                
                # Check if we have tool calls
                tool_calls = [block for block in response.content if block.type == "tool_use"]
                text_blocks = [block for block in response.content if block.type == "text"]
                
                if tool_calls:
                    print(f"[DEBUG] Found {len(tool_calls)} tool calls")
                    
                    # Add assistant message with all content
                    messages.append({"role": "assistant", "content": response.content})
                    
                    # Execute each tool and add results
                    for tool_call in tool_calls:
                        tool_name = tool_call.name
                        tool_input = tool_call.input
                        print(f"[DEBUG] Executing tool: {tool_name} with input: {tool_input}")
                        
                        tool_function = self._get_tool_function(tool_name)
                        if tool_function:
                            try:
                                tool_result = tool_function(**tool_input)
                                print(f"[DEBUG] Tool result: {tool_result[:100]}...")
                                
                                # Add tool result
                                messages.append({
                                    "role": "user",
                                    "content": [{
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": str(tool_result)
                                    }]
                                })
                            except Exception as e:
                                print(f"[DEBUG] Tool execution error: {e}")
                                messages.append({
                                    "role": "user",
                                    "content": [{
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": f"Error executing tool: {str(e)}"
                                    }]
                                })
                        else:
                            print(f"[DEBUG] Tool not found: {tool_name}")
                            messages.append({
                                "role": "user",
                                "content": [{
                                    "type": "tool_result",
                                    "tool_use_id": tool_call.id,
                                    "content": f"Error: Tool {tool_name} not found"
                                }]
                            })
                    
                    # Continue loop to get final response
                    continue
                else:
                    # No tool calls, return the text response
                    if text_blocks:
                        return text_blocks[0].text
                    else:
                        return "No text response generated"
                        
        except Exception as e:
            print(f"[DEBUG] Agent error: {e}")
            return f"Agent error: {str(e)}"
    
    def run_stream(self, user_message: str) -> Generator[str, None, None]:
        """Run the agent with streaming output. Handles tool calling automatically."""
        messages = [{"role": "user", "content": user_message}]
        
        try:
            while True:
                print(f"[DEBUG] Streaming - Sending to Claude with {len(messages)} messages")
                
                # Check if we need to handle tools first (non-streaming)
                response: Message = self.client.messages.create(
                    model=self.model,
                    max_tokens=2000,
                    system=self.instructions,
                    messages=messages,
                    tools=self.tools
                )
                
                # Check if we have tool calls
                tool_calls = [block for block in response.content if block.type == "tool_use"]
                
                if tool_calls:
                    print(f"[DEBUG] Streaming - Found {len(tool_calls)} tool calls, executing...")
                    
                    # Add assistant message with all content
                    messages.append({"role": "assistant", "content": response.content})
                    
                    # Execute each tool and add results
                    for tool_call in tool_calls:
                        tool_name = tool_call.name
                        tool_input = tool_call.input
                        print(f"[DEBUG] Streaming - Executing tool: {tool_name}")
                        
                        tool_function = self._get_tool_function(tool_name)
                        if tool_function:
                            try:
                                tool_result = tool_function(**tool_input)
                                messages.append({
                                    "role": "user",
                                    "content": [{
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": str(tool_result)
                                    }]
                                })
                            except Exception as e:
                                messages.append({
                                    "role": "user",
                                    "content": [{
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": f"Error executing tool: {str(e)}"
                                    }]
                                })
                    
                    # Continue loop to get final response
                    continue
                else:
                    # No tool calls, now stream the final response properly
                    print("[DEBUG] Streaming - No tools needed, streaming final response")
                    
                    from anthropic.lib.streaming import MessageStream
                    
                    stream: MessageStream = self.client.messages.create(
                        model=self.model,
                        max_tokens=2000,
                        system=self.instructions,
                        messages=messages,
                        tools=self.tools,
                        stream=True
                    )
                    
                    for chunk in stream:
                        if chunk.type == "content_block_delta" and chunk.delta.type == "text_delta":
                            yield chunk.delta.text
                    return
                        
        except Exception as e:
            print(f"[DEBUG] Streaming error: {e}")
            yield f"Agent error: {str(e)}"
    
    def run_interactive(self):
        print("UrbanExplorer Agent is ready! Type 'exit' to quit.")
        
        while True:
            try:
                user_input = input("\nYou: ").strip()
                
                if user_input.lower() in ['exit', 'quit']:
                    break
                
                if not user_input:
                    continue
                
                response = self.run(user_input)
                print(f"\nUrbanExplorer: {response}")
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
        
        print("\nGoodbye!")