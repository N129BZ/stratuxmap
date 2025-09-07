

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
