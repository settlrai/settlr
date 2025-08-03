import os
from pathlib import Path
from typing import Generator, List, Dict, Any, Callable, Optional
import anthropic
from anthropic.types import Message
from dotenv import load_dotenv
from coordinates_tool import get_area_coordinates
from regional_interests_tool import get_regional_interests
from properties_tool import get_properties_in_region
from conversation_manager import get_conversation_manager

class UrbanExplorerAgent:
    def __init__(self):
        load_dotenv()
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.name = "UrbanExplorer"
        self.instructions = self._load_instructions()
        self.model = "claude-sonnet-4-20250514"  # Claude 4.0
        self.conversation_manager = get_conversation_manager()
        
    def _load_instructions(self) -> str:
        prompt_path = Path(__file__).parent.parent / "system-prompt.md"
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _define_tools(self, region_id: Optional[int] = None) -> List[Dict[str, Any]]:
        # If region_id is specified, only provide the regional interests tool
        if region_id is not None:
            return [
                {
                    "name": "get_regional_interests_for_area",
                    "description": "Get points of interest for a specific region based on user interests. Fetches region coordinates from database and searches for venues within that region. Automatically saves POIs to database.",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "conversation_id": {
                                "type": "string",
                                "description": "Current conversation ID to link POIs to"
                            },
                            "region_id": {
                                "type": "integer",
                                "description": "The region ID to get coordinates for and save POIs to"
                            },
                            "user_interests": {
                                "type": "string",
                                "description": "List of user interests (e.g \"[karaoke bars, boxing clubs, pizza places]\")"
                            }
                        },
                        "required": ["conversation_id", "region_id", "user_interests"]
                    }
                },
                {
                    "name": "get_properties_in_region",
                    "description": "Get all rental properties that fall within the specified region area. Uses geometric filtering to return properties located inside the region boundaries. Can optionally filter by maximum price.",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "region_id": {
                                "type": "integer",
                                "description": "The region ID to filter properties for"
                            },
                            "conversation_id": {
                                "type": "string",
                                "description": "Current conversation ID for websocket broadcasting"
                            },
                            "max_price": {
                                "type": "integer",
                                "description": "Optional maximum price filter in pounds per month (e.g., 2000 for £2000/month). If not provided, shows all properties."
                            }
                        },
                        "required": ["region_id", "conversation_id"]
                    }
                }
            ]
        
        # Default: provide both tools
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
                "description": "Get points of interest for a specific region based on user interests. Fetches region coordinates from database and searches for venues within that region. Automatically saves POIs to database.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "conversation_id": {
                            "type": "string",
                            "description": "Current conversation ID to link POIs to"
                        },
                        "region_id": {
                            "type": "integer",
                            "description": "The region ID to get coordinates for and save POIs to"
                        },
                        "user_interests": {
                            "type": "string",
                            "description": "List of user interests (e.g \"[karaoke bars, boxing clubs, pizza places]\")"
                        }
                    },
                    "required": ["conversation_id", "region_id", "user_interests"]
                }
            }
        ]
    
    def _get_tool_function(self, tool_name: str) -> Callable:
        """Get the actual function for a tool name."""
        tool_functions = {
            "get_coordinates_for_area": get_area_coordinates,
            "get_regional_interests_for_area": get_regional_interests,
            "get_properties_in_region": get_properties_in_region
        }
        return tool_functions.get(tool_name)
    
    def run_stream(self, user_message: str, conversation_id: str, region_id: Optional[int] = None) -> Generator[str, None, None]:
        """Run the agent with streaming output and conversation ID. Handles tool calling automatically."""
        # Load conversation history (user message already added by API)
        messages = self.conversation_manager.get_conversation_history(conversation_id)
        
        # Add conversation_id and region_id to system instructions
        context_info = f"CURRENT_CONVERSATION_ID: {conversation_id}"
        if region_id is not None:
            print("INSIDE REGION ID WHICH IS NOT NONE")
            context_info += f"\nCURRENT_REGION_ID: {region_id}"
            context_info += f"\n\nMANDATORY TASKS: You MUST perform the following actions:\n1. Call get_regional_interests_for_area tool with conversation_id='{conversation_id}', region_id={region_id}, and user_interests extracted from the conversation.\n2. Call get_properties_in_region tool with region_id={region_id} and conversation_id='{conversation_id}' to show rental properties in the area.\n\nEXCEPTION: If the user is ONLY asking about specific interests/venues and explicitly NOT interested in housing/properties (e.g., 'just show me coffee shops, I don't care about rentals'), then skip calling get_properties_in_region.\n\nDO NOT call get_coordinates_for_area - only call the two tools above."
        instructions_with_context = f"{self.instructions}\n\n{context_info}"
        
        # Get tools based on whether region_id is provided
        tools = self._define_tools(region_id)
        
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
                    tools=tools,
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
                        tools=tools,

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
    