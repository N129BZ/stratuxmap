// metarParser.js
// Handles METAR parsing
import { attachAirportInfo } from './airportInfo.js';
import { skyAndConditionsKeymap } from '/keymaps.js';

export async function parseMetarData(metarJson) {
    if (!metarJson || !metarJson.Data) return null;
    const airportInfo = await attachAirportInfo(metarJson.Location);
    let data = metarJson.Data.replace(/\n/g, ' ').replace(/=+$/, '').trim();

    const reportTypeMatch = data.match(/^(AUTO|COR)?/);
    const windMatch = data.match(/(\d{3})(\d{2,3})(KT)/);
    const visibilityMatch = data.match(/(\d{1,2})\s?(SM)/);
    const skyMatch = data.match(/\b(CL[RU]?|FEW\d{3}|SCT\d{3}|BKN\d{3}|OVC\d{3})\b/);
    const tempDewMatch = data.match(/(\d{2})\/(\d{2})/);
    const altimeterMatch = data.match(/A(\d{4})/);
    const remarksMatch = data.match(/RMK\s+(.+)$/);

    let wind = null;
    if (windMatch) {
        wind = `${windMatch[1]}° ${windMatch[2]} ${windMatch[3]}`;
    }

    let visibility = null;
    if (visibilityMatch) {
        visibility = `${visibilityMatch[1]} ${visibilityMatch[2]}`;
    }

    let sky = null;
    let skyParsed = null;
    if (skyMatch && skyMatch[1]) {
        sky = skyMatch[1];
        const skyLayerMatch = sky.match(/([A-Z]+)(\d{3})/);
        if (skyLayerMatch) {
            skyParsed = {
                type: skyLayerMatch[1],
                altitude: skyLayerMatch[2],
                description: skyAndConditionsKeymap[skyLayerMatch[1]] || skyLayerMatch[1]
            };
            sky = `${skyParsed.type} ${skyParsed.altitude}`;
        }
    }

    let remarks = remarksMatch ? remarksMatch[1].trim() : null;

    let altimeter = null;
    if (altimeterMatch && altimeterMatch[1]) {
        const value = (parseInt(altimeterMatch[1], 10) / 100).toFixed(2);
        const descriptor = 'inHg';
        altimeter = `${value} ${descriptor}`;
    }

    let obj = {
        type: metarJson.Type || 'METAR',
        station: metarJson.Location,
        airport: airportInfo,
        lat: (airportInfo && airportInfo.lat != null) ? airportInfo.lat : "",
        lon: (airportInfo && airportInfo.lon != null) ? airportInfo.lon : "",
        time: metarJson.Time,
        reportType: reportTypeMatch ? reportTypeMatch[1] : null,
        wind,
        visibility,
        sky,
        temperature: tempDewMatch ? tempDewMatch[1] : null,
        dewpoint: tempDewMatch ? tempDewMatch[2] : null,
        altimeter,
        remarks,
        raw: data
    };
    console.log("METAR Data Parsed:", obj);
    return obj;
}
