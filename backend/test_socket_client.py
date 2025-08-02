#!/usr/bin/env python3
"""
Socket.IO client for testing real-time map updates.

Usage:
    python test_socket_client.py

This client connects to the Socket.IO server and listens for map update events.
Run this alongside the backend server to see real-time map updates when the agent
processes area recommendations.
"""

import socketio
import time
import sys

def main():
    # Create Socket.IO client
    sio = socketio.SimpleClient()

    try:
        print("🔌 Connecting to Socket.IO server at http://localhost:8000...")
        sio.connect('http://localhost:8000')
        print("✅ Connected successfully!")
        print("👂 Listening for map updates... (Press Ctrl+C to quit)")
        print("-" * 50)
        
        while True:
            try:
                # Check for events (non-blocking with timeout)
                event = sio.receive(timeout=1)
                if event:
                    event_name, event_data = event
                    
                    if event_name == 'map_update':
                        print(f"🗺️  Map Update Received:")
                        print(f"   Area: {event_data.get('area_name', 'Unknown')}")
                        print(f"   Action: {event_data.get('action', 'Unknown')}")
                        print(f"   Coordinates: {event_data.get('coordinates', [])} points")
                        print(f"   Timestamp: {event_data.get('timestamp', 'Unknown')}")
                        print("-" * 50)
                    
                    elif event_name == 'map_state':
                        print(f"📍 Map State Update:")
                        print(f"   Type: {event_data.get('type', 'Unknown')}")
                        areas = event_data.get('areas', [])
                        print(f"   Areas: {len(areas)} total")
                        if areas:
                            for area in areas:
                                print(f"     - {area.get('area_name', 'Unknown')}")
                        print("-" * 50)
                    
                    else:
                        print(f"📨 Event: {event_name}")
                        print(f"   Data: {event_data}")
                        print("-" * 50)
                        
            except socketio.exceptions.TimeoutError:
                # No events received in timeout period, continue
                pass
            except KeyboardInterrupt:
                print("\n👋 Shutting down...")
                break
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n💡 Make sure the backend server is running:")
        print("   cd backend && uv run uvicorn api:app --reload")
        sys.exit(1)
    finally:
        try:
            sio.disconnect()
            print("✅ Disconnected successfully")
        except:
            pass

if __name__ == "__main__":
    main()