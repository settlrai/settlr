import socketio
from typing import Dict, List, Optional
import json
import logging
import time
from database import get_db_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages Socket.IO connections and broadcasting for map updates."""
    
    def __init__(self):
        # Create Socket.IO server with CORS support and async_mode
        self.sio = socketio.AsyncServer(
            cors_allowed_origins="*",
            logger=True,
            engineio_logger=True,
            async_mode='asgi',
            ping_timeout=60,
        )
        
        # Track connected clients
        self.connected_clients: Dict[str, Dict] = {}
        
        # Current map state
        self.current_map_state: List[Dict] = []
        
        # Register event handlers
        self._register_handlers()
    
    def _register_handlers(self):
        """Register Socket.IO event handlers."""
        
        @self.sio.on('connect')
        async def connect(sid, environ):
            """Handle client connection."""
            logger.info(f"Client connected: {sid}")
            self.connected_clients[sid] = {
                "connected_at": time.time(),
                "session_id": sid
            }
            
            # Send current map state to newly connected client
            if self.current_map_state:
                await self.sio.emit('map_state', {
                    'type': 'initial_state',
                    'areas': self.current_map_state
                }, room=sid)
        
        @self.sio.on('disconnect')
        async def disconnect(sid):
            """Handle client disconnection."""
            logger.info(f"Client disconnected: {sid}")
            if sid in self.connected_clients:
                del self.connected_clients[sid]
        
        @self.sio.on('get_map_state')
        async def get_map_state(sid):
            """Handle request for current map state."""
            await self.sio.emit('map_state', {
                'type': 'current_state',
                'areas': self.current_map_state
            }, room=sid)
    
    async def broadcast_map_update(self, conversation_id: str) -> Dict:
        """
        Broadcast map update with all regions for a conversation to all connected clients.
        
        Args:
            conversation_id: The conversation ID to get regions for
            
        Returns:
            Dict with operation result and current state info
        """
        try:
            # Get all regions for this conversation from database
            db_manager = get_db_manager()
            regions = db_manager.get_conversation_regions(conversation_id)
            
            # Convert regions to dict format and include points of interest
            regions_data = []
            if regions:
                for region in regions:
                    region_dict = region.to_dict()
                    
                    # Get points of interest for this region
                    region_interests = db_manager.get_region_interests(region.region_id)
                    
                    # Add POIs to region data
                    region_dict['points_of_interest'] = []
                    for interest in region_interests:
                        interest_dict = interest.to_dict()
                        region_dict['points_of_interest'].append(interest_dict)
                    
                    regions_data.append(region_dict)
            
            # Prepare update payload
            update_payload = {
                'type': 'map_data',
                'conversation_id': conversation_id,
                'regions': regions_data,
                'timestamp': time.time()
            }
            
            # Broadcast to all connected clients
            if self.connected_clients:
                await self.sio.emit('map_state', update_payload)
                logger.info(f"Broadcasted map data for conversation {conversation_id} with {len(regions_data)} regions to {len(self.connected_clients)} clients")
            else:
                logger.warning("No connected clients to broadcast map update")
            
            return {
                'success': True,
                'conversation_id': conversation_id,
                'regions_count': len(regions_data),
                'connected_clients': len(self.connected_clients)
            }
            
        except Exception as e:
            logger.error(f"Error broadcasting map update: {e}")
            return {
                'success': False,
                'error': str(e),
                'connected_clients': len(self.connected_clients)
            }
    
    def get_current_state(self) -> Dict:
        """Get current map state information."""
        return {
            'connected_clients': len(self.connected_clients),
            'current_areas': len(self.current_map_state),
            'areas': [area['area_name'] for area in self.current_map_state]
        }
    
    def get_socketio_server(self):
        """Get the Socket.IO server instance for ASGI integration."""
        return self.sio

# Global websocket manager instance
websocket_manager = WebSocketManager()