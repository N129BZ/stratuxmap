// stratuxconversion.js
// Converts Stratux ADS-B websocket METAR object to FAA pre-processed METAR format

import airportsData from './airports.json';
import { attachAirportInfo } from './airportInfo.js'

/**
 * Converts a Stratux METAR object to FAA METAR format
 * @param {Object} stratuxObj - The raw Stratux METAR object
 * @param {Object} [stationInfo] - Optional lookup for lat/lon/elevation by station_id
 * @returns {Object} FAA-style METAR object
 */
export async function convertStratuxToFAA(stratuxObj, stationInfo) {
    // If no stationInfo provided, build from airports.json
    if (!stationInfo) {
        stationInfo = await buildStationInfoIndex();
    }

    // Parse METAR string
    const metarRaw = stratuxObj.Data;
    const station_id = stratuxObj.Location;
    const observation_time = await parseObservationTime(stratuxObj.Time);
    const raw_text = metarRaw;
    const metar_type = stratuxObj.Type;

    // Basic regex parsing
    const tempDewRegex = /(\d{2})\/(\d{2})/;
    const windRegex = /(\d{3})(\d{2})KT/;
    const altimRegex = /A(\d{4})/;
    const visRegex = /(\d{1,2})SM/;
    const skyRegex = /(FEW|SCT|BKN|OVC)(\d{3})/g;

    const tempDewMatch = metarRaw.match(tempDewRegex);
    const windMatch = metarRaw.match(windRegex);
    const altimMatch = metarRaw.match(altimRegex);
    const visMatch = metarRaw.match(visRegex);

    // Sky conditions
    let sky_condition = [];
    let skyMatch;
    while ((skyMatch = skyRegex.exec(metarRaw)) !== null) {
        sky_condition.push({
            sky_cover: skyMatch[1],
            cloud_base_ft_agl: String(Number(skyMatch[2]) * 100)
        });
    }

    // Compose output
    return {
        raw_text,
        station_id,
        observation_time,
        latitude: stationInfo?.lat ?? null,
        longitude: stationInfo?.lon ?? null,
        temp_c: tempDewMatch ? Number(tempDewMatch[1]) : null,
        dewpoint_c: tempDewMatch ? Number(tempDewMatch[2]) : null,
        wind_dir_degrees: windMatch ? Number(windMatch[1]) : null,
        wind_speed_kt: windMatch ? Number(windMatch[2]) : null,
        visibility_statute_mi: visMatch ? visMatch[1] : null,
        altim_in_hg: altimMatch ? (Number(altimMatch[1]) / 100).toFixed(2) : null,
        sky_condition,
        flight_category: null, // Needs logic or lookup
        metar_type,
        elevation_m: stationInfo?.elevation_m ?? null
    };
}

function findAirportByICAO(icao) {
    let response = {};
    response = airportsData.find(airport => airport.ident === icao);
    return response;     
}

async function buildStationInfoIndex() {
    // airportsData.airports is an array
    const index = {};
    for (const airport of airportsData.airports) {
        index[airport.ident] = {
            latitude: airport.lat,
            longitude: airport.lon,
            elevation_m: airport.elev
        };
    }
    return index;
}

async function parseObservationTime(timeStr) {
    // Example: "061955Z" => "YYYY-MM-DDTHH:MM:00Z" for current day
    if (!timeStr || !/^\d{6}Z$/.test(timeStr)) return null;
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = timeStr.slice(2, 4);
    const minute = timeStr.slice(4, 6);
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
}

// You can add more helper functions as needed
