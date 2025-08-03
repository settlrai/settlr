import os
import anthropic
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv
from database import get_db_manager
from websocket_manager import websocket_manager

def get_regional_interests(conversation_id: str, region_id: int, user_interests: str) -> str:
    """
    Use a small LLM to find relevant points of interest within geographic regions based on user preferences. 
    Analyzes a geographic boundary and user interests, then returns the top points of interest for each category.

    Args:
        conversation_id: The conversation ID to link POIs to
        region_id: The region ID to get coordinates for and save POIs to
        user_interests: list of interests (e.g "[karaoke bars, boxing clubs, pizza places]")
    
    Returns:
        Raw agent output with points of interest
    """
    print(f"[DEBUG] get_regional_interests called with conversation_id={conversation_id}, region_id={region_id}, user_interests={user_interests}")
    load_dotenv()
    
    # Get region coordinates from database
    db_manager = get_db_manager()
    region = db_manager.get_region(region_id)
    
    if not region:
        print(f"[DEBUG] Region with ID {region_id} not found")
        return f"Error: Region with ID {region_id} not found"
    
    print(f"[DEBUG] Found region: {region.region_name}")
    area_coordinates = region.coordinates
    print(f"[DEBUG] Area coordinates: {area_coordinates}")
    
    client = anthropic.Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY")
    )
    
    print(f"[DEBUG] About to create user_message")
    
    system_prompt = f"""You are a London POI expert. Find points of interest within the specified geographic boundaries based on user interests.

GEOGRAPHIC AREA: {area_coordinates}
USER INTERESTS: {user_interests}

TASK: Find 3-5 relevant points of interest for each user interest within the geographic boundaries.

OUTPUT FORMAT:
Return ONLY a valid JSON object with this structure. NO comments, NO additional text, NO explanations:
{{
  "trendy_cafes": [
    {{
      "name": "Cafe Name",
      "coordinates": {{"latitude": 51.5265, "longitude": -0.0781}},
      "address": "Full address",
      "rating": 4.5,
      "review_count": 123,
      "categories": ["cafe", "coffee"]
    }}
  ]
}}

CRITICAL: 
- Your response must be valid JSON
- Do not include website or gmaps_link fields
- Use exact category names from user interests
- Ensure all quotes are properly closed"""
    
    user_message = f"Find points of interest for these interests: {user_interests} within the geographic area provided."
    
    print(f"[DEBUG] System prompt created, length: {len(system_prompt)}")
    print(f"[DEBUG] User message created, length: {len(user_message)}")

    try:
        print(f"[DEBUG] Sending request to LLM with user_interests: {user_interests}")
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=5000,
            temperature=0.1,
            system=system_prompt,
            messages=[
                {
                    "role": "user", 
                    "content": user_message
                },
                {
                    "role": "assistant",
                    "content": "{"  # Prefill to start json response
                }
            ]
        )
        
        print(f"[DEBUG] LLM response received, content length: {len(response.content[0].text)}")
        poi_json = "{" + response.content[0].text.strip()
        print(f"[DEBUG] Full POI JSON length: {len(poi_json)}")
        
        # Save POIs to database
        try:
            print(f"[DEBUG] Raw POI JSON: {poi_json[:200]}...")
            # Clean JSON by removing comments and fixing incomplete JSON
            import re
            clean_json = re.sub(r'//.*', '', poi_json)
            clean_json = re.sub(r'/\*.*?\*/', '', clean_json, flags=re.DOTALL)
            clean_json = re.sub(r'\s+', ' ', clean_json).strip()
            
            # Try to fix incomplete JSON by adding missing closing braces/brackets
            if not clean_json.endswith('}'):
                # Count opening vs closing braces
                open_braces = clean_json.count('{')
                close_braces = clean_json.count('}')
                open_brackets = clean_json.count('[')
                close_brackets = clean_json.count(']')
                
                # Add missing closing brackets and braces
                clean_json += ']' * (open_brackets - close_brackets)
                clean_json += '}' * (open_braces - close_braces)
            
            print(f"[DEBUG] Cleaned JSON: {clean_json[:200]}...")
            poi_data = json.loads(clean_json)
            print(f"[DEBUG] Parsed POI data keys: {list(poi_data.keys())}")
            
            # Save each interest category to database
            for interest_description, poi_list in poi_data.items():
                print(f"[DEBUG] Processing interest: {interest_description}, POI count: {len(poi_list) if poi_list else 0}")
                if poi_list:  # Only save if there are POIs
                    result = db_manager.add_region_interest(
                        region_id=region_id,
                        conversation_id=conversation_id,
                        interest_type=interest_description,
                        points_of_interest=poi_list
                    )
                    print(f"[DEBUG] Saved region interest with ID: {result.id}")
            
            # Broadcast websocket update
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Create task for running event loop
                    asyncio.create_task(websocket_manager.broadcast_map_update(conversation_id))
                else:
                    asyncio.run(websocket_manager.broadcast_map_update(conversation_id))
            except Exception as ws_error:
                print(f"Error updating websocket: {ws_error}")
                
        except Exception as save_error:
            print(f"Error saving POIs to database: {save_error}")
            print(f"[DEBUG] Full JSON that failed to parse: {clean_json}")
        
        return poi_json
            
    except Exception as e:
        print(f"[DEBUG] Exception in LLM call: {e}")
        return f"Error: {e}"