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

    let wind = { direction: null, speed: null, gust: null };
    if (windMatch) {
        wind.direction = windMatch[1] ? `${windMatch[1]}° C` : null;
        wind.speed = windMatch[2] ? parseInt(windMatch[2]) : null;
        wind.gust = windMatch[3] ? parseInt(windMatch[3]) : null;
    }

    let visibility = {distance: 10, unit: "SM" };
    if (visibilityMatch) {
        visibility.distance = visibilityMatch[1] ? parseInt(visibilityMatch[1]) : null;
        visibility.unit = visibilityMatch[2] ? visibilityMatch[2].trim() : null;
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

    let clouds = parseClouds(data);
    let remarks = remarksMatch ? remarksMatch[1].trim() : null;

    let altimeter = null;
    if (altimeterMatch && altimeterMatch[1]) {
        const value = (parseInt(altimeterMatch[1], 10) / 100).toFixed(2);
        //const descriptor = 'inHg';
        altimeter = value;
    }

    let obj = {
        type: metarJson.Type || 'METAR',
        station: metarJson.Location,
        airport: airportInfo,
        lat: (airportInfo && airportInfo.lat != null) ? airportInfo.lat : null,
        lon: (airportInfo && airportInfo.lon != null) ? airportInfo.lon : null,
        time: metarJson.Time,
        reportType: reportTypeMatch ? reportTypeMatch[1] : null,
        wind,
        visibility,
        sky,
        clouds, 
        temperature: tempDewMatch ? tempDewMatch[1] : null,
        dewpoint: tempDewMatch ? tempDewMatch[2] : null,
        altimeter,
        remarks,
        raw_data: data
    };
    console.log(obj);
    return obj;
}

/**
 * Parse cloud coverages
 * @param metarString raw metar
 * @returns
 */
function parseClouds(metarString) {
    var _a;
    var re = /(NCD|SKC|CLR|NSC|FEW|SCT|BKN|OVC|VV)(\d{3})/g;
    var clouds = new Array();
    var matches;
    while ((matches = re.exec(metarString)) != null) {
        var cloud = {
            abbreviation: matches[1],
            meaning: (_a = CLOUDS[matches[1]]) === null || _a === void 0 ? void 0 : _a.text,
            altitude: parseInt(matches[2]) * 100
        };
        clouds.push(cloud);
    }
    return clouds;
}