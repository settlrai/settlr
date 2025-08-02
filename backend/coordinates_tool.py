import os
import anthropic
import json
from typing import List
from dotenv import load_dotenv
from database import get_db_manager

def get_area_coordinates(area_name: str, conversation_id: str) -> str:
    """
    Use a small LLM to get coordinates for a London area.
    
    Args:
        area_name: Name of the London area (e.g., "Shoreditch", "Stratford International")
    
    Returns:
        Raw agent output with coordinates
    """
    load_dotenv()
    
    client = anthropic.Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY")
    )
    
    system_prompt = """You are a London geography expert. Generate precise coordinates for [AREA NAME] by following the major streets that form its recognized boundaries.

METHODOLOGY:
1. IDENTIFY BOUNDARY STREETS: Research the actual major roads, railways, canals, or landmarks that locals recognize as the area's borders
2. VERIFY COORDINATES: Use real London street intersections and ensure coordinates are in WGS84 format (longitude, latitude)
3. FOLLOW STREET GEOMETRY: Place points that actually follow the street layout, not straight lines

COORDINATE REQUIREMENTS:
- Format: [longitude, latitude] in decimal degrees
- Longitude range: -0.5 to 0.3 (London bounds)
- Latitude range: 51.3 to 51.7 (London bounds)
- Precision: 4 decimal places minimum
- Close polygon: Last coordinate must match the first

BOUNDARY IDENTIFICATION PROCESS:
1. Start with the most commonly recognized boundary streets for the area
2. Place coordinates at major intersections of these boundary streets
3. Add intermediate points every 200-500 meters along long or curved boundaries
4. Generate 8-15 coordinates total for proper area representation
5. Move clockwise or counter-clockwise consistently

VALIDATION CHECKS:
- Verify each coordinate actually falls on or near the intended boundary street
- Ensure the polygon encloses the correct neighborhoods and excludes areas that shouldn't be included
- Check that major landmarks within the area fall inside the polygon

OUTPUT FORMAT:
Return ONLY a valid JSON object with coordinates array. NO comments, NO additional text, NO explanations:
{"coordinates": [[-0.0781, 51.5265], [-0.0745, 51.5285], [-0.0725, 51.5245], [-0.0781, 51.5265]]}

CRITICAL: Your response must be valid JSON. Do not include any comments (// or /* */) or explanations.

AREA TO MAP: [INSERT SPECIFIC AREA NAME HERE]"""

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1000,
            system=system_prompt,
            messages=[
                {
                    "role": "user", 
                    "content": f"Build a street-based polygon for {area_name} in London using major boundary streets and intersections."
                },
                {
                    "role": "assistant",
                    "content": "{"  # Prefill to start JSON object
                }
            ]
        )
        
        coordinates_json = "{" + response.content[0].text.strip()

        # If conversation_id provided, save to database
        if conversation_id:
            try:
                print("MAX COORDINATES")
                print(coordinates_json)
                
                # Clean JSON by removing comments
                import re
                # Remove // comments
                coordinates_json = re.sub(r'//.*', '', coordinates_json)
                # Remove /* */ comments
                coordinates_json = re.sub(r'/\*.*?\*/', '', coordinates_json, flags=re.DOTALL)
                # Remove extra whitespace
                coordinates_json = re.sub(r'\s+', ' ', coordinates_json).strip()
                
                coordinates_data = json.loads(coordinates_json)
                coordinates = coordinates_data.get("coordinates", [])
                
                if coordinates:
                    db_manager = get_db_manager()
                    db_manager.add_conversation_region(
                        conversation_id=conversation_id,
                        region_name=area_name,
                        coordinates=coordinates
                    )
            except Exception as save_error:
                print(f"Error saving to database: {save_error}")
        
        return coordinates_json
            
    except Exception as e:
        return f"Error: {e}"