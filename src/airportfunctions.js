
export async function attachAirportInfo(station) {
    try {
        const response = await fetch(`/airport?id=${station}`);
        if (!response.ok) {
            return {};
        }
        const airport = await response.json();
        return airport; 
    }
    catch (error) 
    {
        return {};
    }
}

export async function getAirportsInRadius(lat, lon, radiusMiles) {
    try {
        const { minLat, maxLat, minLon, maxLon } = getBoundingBox(lat, lon, radiusMiles);
        const response = await fetch(`/airportlist?minLat=${minLat}&maxLat=${maxLat}&minLon=${minLon}&maxLon=${maxLon}`);
        if (!response.ok) {
            return [];
        }
        const airports = await response.json();
        return airports; 
    }
    catch (error) 
    {
        return [];
    }
}

function getBoundingBox(centerLat, centerLon, radiusMiles) {
    const earthRadiusMiles = 3959; // Earth's radius in miles
    
    // Convert radius from miles to radians
    const radiusRadians = radiusMiles / earthRadiusMiles;
    
    // Convert center coordinates to radians
    const latRad = centerLat * (Math.PI / 180);
    const lonRad = centerLon * (Math.PI / 180);
    
    // Calculate bounding box
    const minLat = centerLat - (radiusRadians * 180 / Math.PI);
    const maxLat = centerLat + (radiusRadians * 180 / Math.PI);
    
    // Longitude calculation accounts for latitude compression
    const deltaLon = Math.asin(Math.sin(radiusRadians) / Math.cos(latRad)) * 180 / Math.PI;
    const minLon = centerLon - deltaLon;
    const maxLon = centerLon + deltaLon;
    
    return {
        minLat: minLat,
        maxLat: maxLat,
        minLon: minLon,
        maxLon: maxLon
    };
}