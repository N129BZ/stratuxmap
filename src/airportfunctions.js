
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

export async function getAirportsInRadius(lon, lat, radiusMiles) {
    try {
        console.log(`Getting airports for lat: ${lat}, lon: ${lon}, radius: ${radiusMiles} miles`);
        
        const { minLat, maxLat, minLon, maxLon } = getBoundingBox(lat, lon, radiusMiles);

        console.log(`Bounding box: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`);

        // log a sample sql statement for debugging
        let sql = `SELECT ident, name, type, longitude_deg, latitude_deg, elevation_ft 
		           FROM airports 
		           WHERE latitude_deg >= ${minLat} AND latitude_deg <= ${maxLat} 
		           AND longitude_deg >= ${minLon} AND longitude_deg <= ${maxLon};`;
        
        console.log("AirportList SQL:", sql);

        const response = await fetch(`/airportlist?minLat=${minLat}&maxLat=${maxLat}&minLon=${minLon}&maxLon=${maxLon}`);
        if (!response.ok) {
            console.log(`Response not OK: ${response.status} ${response.statusText}`);
            return [];
        }
        const airports = await response.json();
        console.log(`Found ${airports.length} airports`);
        return airports; 
    }
    catch (error) 
    {
        console.log("Error in getAirportsInRadius:", error);
        return [];
    }
}

function getBoundingBox(centerLat, centerLon, radiusMiles) {
    // Convert miles to degrees (approximate)
    // 1 degree of latitude ≈ 69 miles everywhere
    // 1 degree of longitude ≈ 69 miles * cos(latitude)
    
    const latRadiusDegrees = radiusMiles / 69.0;
    
    // Calculate latitude bounds
    const minLat = centerLat - latRadiusDegrees;
    const maxLat = centerLat + latRadiusDegrees;
    
    // Calculate longitude bounds (accounting for latitude compression)
    const latRad = centerLat * (Math.PI / 180);
    const lonRadiusDegrees = radiusMiles / (69.0 * Math.cos(latRad));
    
    const minLon = centerLon - lonRadiusDegrees;
    const maxLon = centerLon + lonRadiusDegrees;
    
    // Clamp latitude to valid range
    const clampedMinLat = Math.max(-90, minLat);
    const clampedMaxLat = Math.min(90, maxLat);
    
    // For longitude, don't normalize - just use the calculated values
    // The database should handle longitude wrapping if needed
    
    return {
        minLat: clampedMinLat,
        maxLat: clampedMaxLat,
        minLon: minLon,
        maxLon: maxLon
    };
}