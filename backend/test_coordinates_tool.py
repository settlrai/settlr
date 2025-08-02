#!/usr/bin/env python3
"""
Test script for coordinates tool using small LLM.
Run manually to test coordinate fetching functionality.
"""

from coordinates_tool import get_area_coordinates

def test_area_coordinates(area_name: str) -> None:
    """Test coordinate fetching for a given London area name."""
    print(f"\n{'='*60}")
    print(f"Testing coordinates for: {area_name}")
    print('='*60)
    
    result: str = get_area_coordinates(area_name)
    
    print(f"Raw agent output:")
    print(result)

def main() -> None:
    """Main test function."""
    print("Coordinates Tool Test - Small LLM Approach")
    print("Testing London area coordinate fetching...")
    
    # Test various London areas
    test_areas: List[str] = [
        "Shoreditch",
        "Stratford", 
        "Camden",
        "Hackney",
        "Bermondsey",
        "King's Cross",
        "Canary Wharf"
    ]
    
    for area in test_areas:
        test_area_coordinates(area)
    
    print(f"\n{'='*60}")
    print("Testing complete!")

if __name__ == "__main__":
    main()