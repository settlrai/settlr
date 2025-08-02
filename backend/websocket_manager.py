import socketio
from typing import Dict, List, Optional
import json
import logging
import time

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
            async_mode='asgi'
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
    
    async def broadcast_map_update(self, area_name: str, coordinates: List[List[float]], action: str = "add") -> Dict:
        """
        Broadcast map update to all connected clients.
        
        Args:
            area_name: Name of the area/neighborhood
            coordinates: List of [longitude, latitude] coordinate pairs
            action: Type of action ('add', 'remove', 'clear', 'highlight')
            
        Returns:
            Dict with operation result and current state info
        """
        try:
            # Prepare update payload
            update_payload = {
                'type': 'map_update',
                'action': action,
                'area_name': area_name,
                'coordinates': coordinates,
                'timestamp': time.time()
            }
            
            # Update current map state based on action
            if action == "add":
                # Remove existing area if present, then add new
                self.current_map_state = [area for area in self.current_map_state if area['area_name'] != area_name]
                self.current_map_state.append({
                    'area_name': area_name,
                    'coordinates': coordinates,
                    'action': action
                })
            elif action == "remove":
                self.current_map_state = [area for area in self.current_map_state if area['area_name'] != area_name]
            elif action == "clear":
                self.current_map_state = []
            
            # Broadcast to all connected clients
            if self.connected_clients:
                await self.sio.emit('map_update', update_payload)
                logger.info(f"Broadcasted map update for {area_name} to {len(self.connected_clients)} clients")
            else:
                logger.warning("No connected clients to broadcast map update")
            
            return {
                'success': True,
                'action': action,
                'area_name': area_name,
                'connected_clients': len(self.connected_clients),
                'current_areas': len(self.current_map_state)
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