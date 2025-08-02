import asyncio
from websocket_manager import websocket_manager
import logging

logger = logging.getLogger(__name__)

def update_map(conversation_id: str) -> str:
    """
    Update the map with all regions for a conversation via websocket broadcast.
    
    This tool gets all regions associated with a conversation and sends them
    to connected frontend clients for real-time map visualization updates.
    
    Args:
        conversation_id: The conversation ID to get regions for
    
    Returns:
        String describing the operation result and current map state
    """
    try:
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
                        websocket_manager.broadcast_map_update(conversation_id)
                    )
                    result = future.result(timeout=10)
            except RuntimeError:
                # No running loop, create new one
                result = asyncio.run(
                    websocket_manager.broadcast_map_update(conversation_id)
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
            response_parts = [
                f"✅ Map updated successfully for conversation {conversation_id}",
                f"Regions sent: {result.get('regions_count', 0)}",
                f"Connected clients: {result['connected_clients']}"
            ]
            
            return "\n".join(response_parts)
        else:
            return f"❌ Map update failed for conversation {conversation_id}: {result.get('error', 'Unknown error')}"
            
    except Exception as e:
        logger.error(f"Map update tool error: {e}")
        return f"Error updating map for conversation {conversation_id}: {str(e)}"

