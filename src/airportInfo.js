// airportInfo.js
// Handles fetching and formatting airport info

export async function attachAirportInfo(station) {
    try {
        //console.log(`Fetching airport info for station: ${station}`);
        const response = await fetch(`/airport/${station}`);
        if (!response.ok) {
            console.log(`No airport info found for station: ${station}`);
            return null;
        }
        const airport = await response.json();
        return airport; 
    }
    catch (error) 
    {
        console.log(error);
        return {};
    }
}
