// pirepParser.js
// Handles PIREP parsing
export function parsePirepData(pirepJson) {
    if (!pirepJson || !pirepJson.Data) return null;
    let data = pirepJson.Data.replace(/\n/g, ' ').replace(/=+$/, '').trim();

    const locationMatch = data.match(/\/OV\s*([A-Z0-9]+)/i);
    const timeMatch = data.match(/\/TM\s*(\d{4})/i);
    const flightLevelMatch = data.match(/\/FL\s*(\d{3,4})/i);
    const aircraftMatch = data.match(/\/TP\s*([A-Z0-9\-]+)/i);
    const skyMatch = data.match(/\/SK\s*([A-Z0-9]+)/i);
    const remarksMatch = data.match(/\/RM\s*(.+)$/i);

    let sky = skyMatch ? skyMatch[1] : null;
    if (sky) {
        const match = sky.match(/([A-Z]+)(\d{3})?/);
        if (match) {
            sky = match[2] ? `${match[1]} ${match[2]}` : match[1];
        }
    }

    return {
        type: pirepJson.Type || 'PIREP',
        station: pirepJson.Location,
        time: pirepJson.Time,
        location: locationMatch ? locationMatch[1] : "",
        pirepTime: timeMatch ? timeMatch[1] : "",
        flightLevel: flightLevelMatch ? flightLevelMatch[1] : "",
        aircraft: aircraftMatch ? aircraftMatch[1] : "",
        sky,
        remarks: remarksMatch ? remarksMatch[1].trim() : "",
        raw: data
    };
}
