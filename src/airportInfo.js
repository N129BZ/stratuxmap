// airportInfo.js
// Handles fetching and formatting airport info

export async function attachAirportInfo(station) {
    try {
        //console.log(`Fetching airport info for station: ${station}`);
        const response = await fetch(`/airport/${station}`);
        if (!response.ok) return null;
        const airport = await response.json();
        return airport;
    } catch (error) {
        return {};
    }
}
