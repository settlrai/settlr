import json
import asyncio
from typing import List, Dict, Any
from websocket_manager import websocket_manager
import logging

logger = logging.getLogger(__name__)

def update_map(area_name: str, coordinates: str, action: str = "add") -> str:
    """
    Update the map with new area coordinates via websocket broadcast.
    
    This tool sends neighborhood coordinates to connected frontend clients 
    for real-time map visualization updates.
    
    Args:
        area_name: Name of the London area/neighborhood (e.g., 'Shoreditch', 'Camden')
        coordinates: Coordinate array as string in format '[[lng,lat],[lng,lat],...]'
        action: Action type - 'add' (default), 'remove', 'clear', 'highlight'
    
    Returns:
        String describing the operation result and current map state
    """
    try:
        # Parse coordinates string to list
        if isinstance(coordinates, str):
            coordinates_list = json.loads(coordinates)
        else:
            coordinates_list = coordinates
            
        # Validate coordinates format
        if not isinstance(coordinates_list, list):
            return f"Error: Coordinates must be a list, got {type(coordinates_list)}"
        
        if not coordinates_list:
            return "Error: Coordinates list cannot be empty"
            
        # Validate each coordinate pair
        for i, coord in enumerate(coordinates_list):
            if not isinstance(coord, list) or len(coord) != 2:
                return f"Error: Coordinate {i} must be [longitude, latitude] pair"
            
            lng, lat = coord
            if not isinstance(lng, (int, float)) or not isinstance(lat, (int, float)):
                return f"Error: Coordinate {i} values must be numbers"
            
            # Basic London bounds validation
            if not (-0.5 <= lng <= 0.3) or not (51.3 <= lat <= 51.7):
                logger.warning(f"Coordinate {coord} appears to be outside London bounds")
        
        # Use asyncio to run the async broadcast function
        try:
            # Check if we're in an async context
            try:
                loop = asyncio.get_running_loop()
                # We're in an async context, schedule a task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        websocket_manager.broadcast_map_update(area_name, coordinates_list, action)
                    )
                    result = future.result(timeout=10)
            except RuntimeError:
                # No running loop, create new one
                result = asyncio.run(
                    websocket_manager.broadcast_map_update(area_name, coordinates_list, action)
                )
        except Exception as e:
            logger.error(f"Error running async broadcast: {e}")
            # Fallback: just return a mock success result
            result = {
                'success': False,
                'error': f"Async execution failed: {str(e)}",
                'connected_clients': 0
            }
        
        # Format response for the agent
        if result['success']:
            current_state = websocket_manager.get_current_state()
            
            response_parts = [
                f"✅ Map updated successfully for {area_name}",
                f"Action: {action}",
                f"Coordinates: {len(coordinates_list)} points",
                f"Connected clients: {result['connected_clients']}",
                f"Total areas on map: {current_state['current_areas']}"
            ]
            
            if current_state['areas']:
                response_parts.append(f"Current areas: {', '.join(current_state['areas'])}")
            
            return "\n".join(response_parts)
        else:
            return f"❌ Map update failed for {area_name}: {result.get('error', 'Unknown error')}"
            
    except json.JSONDecodeError as e:
        return f"Error: Invalid coordinates format - {str(e)}. Expected format: [[lng,lat],[lng,lat],...]"
    except Exception as e:
        logger.error(f"Map update tool error: {e}")
        return f"Error updating map for {area_name}: {str(e)}"

def clear_map() -> str:
    """
    Clear all areas from the map.
    
    Returns:
        String describing the operation result
    """
    return update_map("", "[]", "clear")

def get_map_state() -> str:
    """
    Get current map state information.
    
    Returns:
        String describing current map state
    """
    try:
        state = websocket_manager.get_current_state()
        
        response_parts = [
            f"📍 Current Map State:",
            f"Connected clients: {state['connected_clients']}",
            f"Areas displayed: {state['current_areas']}"
        ]
        
        if state['areas']:
            response_parts.append(f"Areas: {', '.join(state['areas'])}")
        else:
            response_parts.append("No areas currently displayed")
            
        return "\n".join(response_parts)
        
    except Exception as e:
        logger.error(f"Get map state error: {e}")
        return f"Error getting map state: {str(e)}"