// windParser.js
// Handles wind data parsing
import { attachAirportInfo } from './airportInfo.js';

export async function parseWindData(windJson) {
    if (!windJson || !windJson.Data) return null;
    let loc = windJson.Location.length < 4 ? `K${windJson.Location}` : windJson.Location;
    const airportInfo = await attachAirportInfo(loc);
    let data = windJson.Data.replace(/\n/g, ' ').replace(/=+$/, '').trim();

    const headerMatch = data.match(/FT\s+([\d\s]+)/);
    const levels = headerMatch
        ? headerMatch[1].trim().split(/\s+/)
        : [];

    const windTempGroups = [];
    const groupRegex = /(\d{2})(\d{2})([+-]\d{2})/g;
    let groupMatch;
    let groupDataLine = data.replace(/FT\s+[\d\s]+/, '').trim();
    while ((groupMatch = groupRegex.exec(groupDataLine)) !== null) {
        windTempGroups.push({
            direction: groupMatch[1],
            speed: groupMatch[2],
            temperature: groupMatch[3]
        });
    }

    const winds = levels.map((level, i) => ({
        level,
        direction: windTempGroups[i] ? windTempGroups[i].direction : null,
        speed: windTempGroups[i] ? windTempGroups[i].speed : null,
        temperature: windTempGroups[i] ? windTempGroups[i].temperature : null
    })).filter(w =>
        w.direction !== null || w.speed !== null || w.temperature !== null
    );

    if (windJson.Location.length === 3) {
        windJson.Location = `K${windJson.Location}`;
    }

    return {
        type: windJson.Type || 'WINDS',
        station: windJson.Location,
        stationName: airportInfo ? airportInfo.name : null,
        time: windJson.Time,
        winds,
        raw: data
    };
}
