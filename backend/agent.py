import os
import json
from pathlib import Path
from typing import Generator, List, Dict, Any, Callable
import anthropic
from anthropic.types import Message
from dotenv import load_dotenv
from coordinates_tool import get_area_coordinates
from map_update_tool import update_map
from regional_interests_tool import get_regional_interests
from conversation_manager import get_conversation_manager

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
        self.conversation_manager = get_conversation_manager()
        
    def _load_instructions(self) -> str:
        prompt_path = Path(__file__).parent.parent / "system-prompt.md"
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _define_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "get_coordinates_for_area",
                "description": "Get boundary coordinates for a London area/neighborhood. Returns coordinate array for polygon rendering on maps. When using this tool, automatically save regions to database by passing conversation_id parameter.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "area_name": {
                            "type": "string",
                            "description": "Name of the London area (e.g., 'Shoreditch', 'Camden', 'King's Cross')"
                        },
                        "conversation_id": {
                            "type": "string",
                            "description": "Current conversation ID to save region to database"
                        }
                    },
                    "required": ["area_name", "conversation_id"]
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
            "get_regional_interests_for_area": get_regional_interests
        }
        return tool_functions.get(tool_name)
    
    def run_stream(self, user_message: str, conversation_id: str) -> Generator[str, None, None]:
        """Run the agent with streaming output and conversation ID. Handles tool calling automatically."""
        # Load conversation history (user message already added by API)
        messages = self.conversation_manager.get_conversation_history(conversation_id)
        
        # Add conversation_id to system instructions
        instructions_with_context = f"{self.instructions}\n\nCURRENT_CONVERSATION_ID: {conversation_id}"
        
        # Variable to collect the final assistant response
        final_response = ""
        
        try:
            while True:
                print(f"[DEBUG] Streaming - Sending to Claude with {len(messages)} messages")
                
                # Check if we need to handle tools first (non-streaming)
                response: Message = self.client.messages.create(
                    model=self.model,
                    max_tokens=2000,
                    system=instructions_with_context,
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
                        system=instructions_with_context,
                        messages=messages,
                        tools=self.tools,
                        stream=True
                    )
                    
                    for chunk in stream:
                        if chunk.type == "content_block_delta" and chunk.delta.type == "text_delta":
                            final_response += chunk.delta.text
                            yield chunk.delta.text
                    
                    # Save the final assistant response to conversation
                    if final_response:
                        self.conversation_manager.add_assistant_message(conversation_id, final_response)
                    
                    return
                        
        except Exception as e:
            print(f"[DEBUG] Streaming error: {e}")
            yield f"Agent error: {str(e)}"
    