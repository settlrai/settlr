import json
import asyncio
from typing import List, Dict, Any, Optional
from shapely.geometry import Polygon, Point
from database import get_db_manager, RegionBorder
from sqlalchemy import text
from websocket_manager import websocket_manager


def get_properties_in_region(region_id: int, conversation_id: str) -> List[Dict[str, Any]]:
    """
    Get all properties that fall within the specified region area using convex hull geometry.
    
    Args:
        region_id: ID of the region from region_borders table
        conversation_id: Current conversation ID for websocket broadcasting
        
    Returns:
        List of property dictionaries containing all fields:
        - id, property_id, source, property_link, price, address
        - bedrooms, bathrooms, area_sqm, search_area, search_query
        - title, description, images, floor_plan_url, coordinates
    """
    try:
        db_manager = get_db_manager()
        
        with db_manager.get_session() as session:
            # Get region coordinates from region_borders table
            region_border = session.query(RegionBorder).filter(
                RegionBorder.id == region_id
            ).first()
            
            if not region_border or not region_border.coordinates:
                print(f"Region with id {region_id} not found or has no coordinates")
                return []
            
            # Parse region coordinates
            try:
                region_coords = json.loads(region_border.coordinates)
                if not region_coords or len(region_coords) < 3:
                    print(f"Invalid region coordinates for region_id {region_id}")
                    return []
            except json.JSONDecodeError as e:
                print(f"Error parsing region coordinates: {e}")
                return []
            
            # Create shapely Polygon from region coordinates
            # Coordinates are in [longitude, latitude] format
            try:
                polygon = Polygon(region_coords)
                if not polygon.is_valid:
                    print(f"Invalid polygon created for region_id {region_id}")
                    return []
            except Exception as e:
                print(f"Error creating polygon: {e}")
                return []
            
            # Get all properties from properties_with_coordinates table
            query = text("""
                SELECT id, property_id, source, property_link, price, address,
                       bedrooms, bathrooms, area_sqm, search_area, search_query,
                       title, description, images, floor_plan_url, coordinates
                FROM properties_with_coordinates
                WHERE coordinates IS NOT NULL AND coordinates != ''
            """)
            
            result = session.execute(query)
            properties = result.fetchall()
            
            filtered_properties = []
            
            for property_row in properties:
                try:
                    # Parse property coordinates
                    prop_coords = json.loads(property_row.coordinates)
                    
                    # Coordinates are in [longitude, latitude] format
                    if len(prop_coords) >= 2:
                        point = Point(prop_coords[0], prop_coords[1])
                        
                        # Check if property point is within the region polygon
                        if polygon.contains(point):
                            # Convert row to dictionary
                            property_dict = {
                                'id': property_row.id,
                                'property_id': property_row.property_id,
                                'source': property_row.source,
                                'property_link': property_row.property_link,
                                'price': property_row.price,
                                'address': property_row.address,
                                'bedrooms': property_row.bedrooms,
                                'bathrooms': property_row.bathrooms,
                                'area_sqm': property_row.area_sqm,
                                'search_area': property_row.search_area,
                                'search_query': property_row.search_query,
                                'title': property_row.title,
                                'description': property_row.description,
                                'images': property_row.images,
                                'floor_plan_url': property_row.floor_plan_url,
                                'coordinates': property_row.coordinates
                            }
                            filtered_properties.append(property_dict)
                            
                except json.JSONDecodeError:
                    # Skip properties with invalid coordinate format
                    continue
                except Exception as e:
                    # Skip properties that cause other errors
                    print(f"Error processing property {property_row.id}: {e}")
                    continue
            
            print(f"Found {len(filtered_properties)} properties in region {region_id}")
            
            # Broadcast properties to websocket clients
            try:
                # Try to get the current event loop
                try:
                    loop = asyncio.get_running_loop()
                    # If we're in an event loop, create a task
                    loop.create_task(websocket_manager.broadcast_map_update(conversation_id, filtered_properties))
                except RuntimeError:
                    # No running loop, safe to use asyncio.run()
                    asyncio.run(websocket_manager.broadcast_map_update(conversation_id, filtered_properties))
            except Exception as ws_error:
                print(f"Error updating websocket with properties: {ws_error}")
            
            return filtered_properties
            
    except Exception as e:
        print(f"Error in get_properties_in_region: {e}")
        return []