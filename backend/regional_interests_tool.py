import os
import anthropic
from dotenv import load_dotenv

def get_regional_interests(area_coordinates: str, interests: str) -> str:
    """
    Use a small LLM to find relevant points of interest within geographic regions based on user preferences. 
    Analyzes a geographic boundary and user interests, then returns the top points of interest for each category.

    Args:
        area_coordinates: Coordinates of the London area (e.g., "[[-0.095,51.535],[-0.095,51.533],[-0.094,51.531],[-0.095,51.535]]")
        interests: list of interests (e.g "[karaoke bars, boxing clubs, pizza places]")
    
    Returns:
        Raw agent output with coordinates and
    """
    load_dotenv()
    
    client = anthropic.Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY")
    )
    
    system_prompt = """
    You are a specialized sub-agent that finds relevant points of interest within geographic regions based on user preferences. 
    Your task is to analyze a geographic boundary and user interests, then return the top points of interest for each category.
    """
    user_message = f"""
        ## Input Format
        You will receive:
        1. **{{area_coordinates}}** A an array of coordinates defining the geographic area of interest
        2. **{{user_interests}}**: An array of strings describing what the user likes (e.g., "[user likes indian restaurants, user is a karaoke fan]")
        ## Task Overview
        For each user interest, find the top 20 most relevant points of interest within the specified geographic boundaries and return their details with coordinates.
        ## Step-by-Step Process
        ### Step 1: Parse and Validate Input
        - Examine the array to understand the geographic boundaries
        - Parse each user interest string to extract the core category/type
        - Identify any specific preferences or qualifiers mentioned
        ### Step 2: Interest Analysis and Categorization
        For each interest:
        - Extract the main point of interest type (e.g., \"indian restaurants\" → restaurants with Indian cuisine)
        - Identify relevant Google Maps categories and search terms
        - Consider synonyms and related categories that might be relevant
        - Note any quality indicators or specific requirements
        ### Step 3: Geographic Analysis
        - Determine the center point of the region for search optimization
        - Calculate the approximate radius or bounding box of the area
        - Consider the region's characteristics (urban/rural, size, density) for search strategy
        ### Step 4: Point of Interest Search Strategy
        For each interest category:
        - Formulate appropriate search queries for Google Maps/Places API
        - Consider multiple related search terms to ensure comprehensive coverage
        - Plan search methodology to cover the entire region effectively
        ### Step 5: Data Collection and Filtering
        - Search for points of interest within the geographic boundaries
        - Verify each result is actually within the specified GeoJSON boundaries
        - Collect essential data: name, coordinates, rating, review count, address
        - Filter out permanently closed or invalid locations
        ### Step 6: Ranking and Selection
        For each interest category:
        - Rank results based on relevance, rating, and popularity
        - Consider factors like:
            - Star rating and number of reviews
            - Distance from region center
            - Relevance to the specific interest
            - Current operational status
        - Select the top 20 results for each category
        ### Step 7: Output Formatting
        Structure the response as a dictionary mapping each interest to its results.
        ## Output Format
        Return a JSON dictionary with this structure:
        
        {
            "interest_1_description": [
            {
                "name": "Point of Interest Name",
                "coordinates": {
                "latitude": 0.000000,
                "longitude": 0.000000
                },
                "address": "Full address",
                "rating": 4.5,
                "review_count": 123,
                "categories": ["category1", "category2"],
                "website": "https://example.com",
                "gmaps_link": "https://maps.app.goo.gl/c6GdPp1dY1jsbXFaA"
            }
            ],
            "interest_2_description": [
            // ... up to 20 more POIs
            ]
        }
        
        ## Important Considerations
        
        ### Geographic Accuracy
        - Ensure all returned points are actually within the provided GeoJSON boundaries
        - Use precise coordinate checking, not just approximate distance calculations
        - Handle complex polygon shapes and multiple polygons if present
        
        ### Data Quality
        - Prioritize POIs with recent reviews and high ratings
        - Exclude permanently closed businesses
        - Verify coordinate accuracy
        - Include only legitimate, publicly accessible locations
        
        ### Interest Matching
        - Be flexible with interest interpretation (e.g., \"coffee lover\" should include cafes, coffee shops, roasteries)
        - Consider cultural and regional variations in naming
        - Handle ambiguous interests by choosing the most common interpretation
        
        ### Error Handling
        - If fewer than 20 POIs exist for an interest, return all available
        - If no POIs found for an interest, return an empty array with a note
        - Handle malformed GeoJSON gracefully with appropriate error messages
        
        ## Special Instructions
        1. **Boundary Checking**: Always verify each POI is within the GeoJSON boundaries before including it
        2. **Duplicate Handling**: Remove duplicate POIs that might appear under multiple search terms
        3. **Data Freshness**: Prioritize recently reviewed and currently operating businesses
        4. **Comprehensive Coverage**: Don't just search from the center - ensure coverage of the entire region
        5. **FORMAT**: JUST return the json
        
        ## Example Workflow
        Given input:
        - polygon covering downtown Seattle
        - Interests: "[user likes craft beer, user enjoys live music]"
        Process:
        1. Parse Seattle downtown boundaries
        2. Map \"craft beer\" → breweries, beer bars, taphouses
        3. Map \"live music\" → music venues, bars with live music, concert halls
        4. Search within boundaries for each category
        5. Rank by rating, reviews, and relevance
        6. Return top 20 for each interest with full details
        Remember: Your goal is to provide highly relevant, accurate, and current points of interest that truly match the user's interests within their specified geographic area."
    """

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=5000,
            temperature=0.1,
            system=system_prompt,
            messages=[
                {
                    "role": "user", 
                    "content": f"{user_message}"
                },
                {
                    "role": "assistant",
                    "content": "{"  # Prefill to start json response
                }
            ]
        )
        
        return "{" + response.content[0].text.strip()
            
    except Exception as e:
        return f"Error: {e}"