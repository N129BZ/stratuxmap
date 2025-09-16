// stratuxconversion.js
// Converts Stratux ADS-B websocket weather object to FAA pre-processed object format

import { stateCache } from './map.js';

/**
 * Converts a Stratux METAR object to FAA METAR format
 * @param {Object} stratuxObject - The raw Stratux METAR object
 * @param {Object} [stationInfo] - Optional lookup for lat/lon/elevation by station_id
 * @returns {Object} FAA-style METAR object
 */
export async function convertStratuxToFAA(stratuxObject, stationInfo) {
    
    let location = stratuxObject.Location;

    if (location.length === 3) {
        location = `K${location}`;
        stratuxObject.Location = location; 
    }

    stationInfo = await attachAirportInfo(location);
    
    if (stationInfo.lat === 0 || stationInfo.lon === 0) {
        return null;
    }

    // Make sure stratuxObject.Location is a string airport code, e.g. "KORD"
    const cleanedData = stratuxObject.Data.replace(/\s*\n\s*/g, ' ').trim();
    const forecast = parseWeatherForecast(stratuxObject.Data);

    // Time handling
    let timestamp = stratuxObject.Time;
    let loc_time = stratuxObject.LocaltimeReceived.replace(/^0001-01-01/, '');


    // Weather handling
    const weatherRaw = `${location} ${timestamp} ${cleanedData}`;
    const station_id = location;
    const observation_time = await parseObservationTime(loc_time);
    //if (!weatherRaw) debugger; 
    const raw_text = weatherRaw;
    const metar_type = stratuxObject.Type;

    // Basic regex parsing
    const tempDewRegex = /(\d{2})\/(\d{2})/;
    // Wind regex: direction, speed, optional gusts, always followed by KT
    const windRegex = /(\d{3})(\d{2})G?(\d{2})?KT/;
    const altimRegex = /A(\d{4})/;
    const visRegex = /(\d{1,2})SM/;
    const skyRegex = /(FEW|SCT|BKN|OVC)(\d{3})/g;

    const tempDewMatch = weatherRaw.match(tempDewRegex);
    const windMatch = weatherRaw.match(windRegex);
    const altimMatch = weatherRaw.match(altimRegex);
    const visMatch = weatherRaw.match(visRegex);

    // Extract wind values robustly
    let wind_dir_degrees = windMatch ? Number(windMatch[1]) : "";
    let wind_speed_kt = windMatch ? Number(windMatch[2]) : "";
    let wind_gust_kt = windMatch && windMatch[3] ? Number(windMatch[3]) : "";

    // Sky conditions
    let sky_condition = [];
    let skyMatch;
    while ((skyMatch = skyRegex.exec(weatherRaw)) !== null) {
        sky_condition.push({
            sky_cover: skyMatch[1],
            cloud_base_ft_agl: String(Number(skyMatch[2]) * 100)
        });
    }

    let visMiles = visMatch ? Number(visMatch[1]) : 10;
    let cond = "";

    if (visMiles < 1) cond = "LIFR";
    else if (visMiles < 3) cond = "IFR";
    else if (visMiles < 5) cond = "MVFR";
    else cond = "VFR";

    let output = {
        raw_text,
        type: stratuxObject.Type,
        station_id: location,
        station_name: stationInfo?.name ?? "",
        timestamp: stratuxObject.Time,
        observation_time,
        latitude: stationInfo?.lat ?? "",
        longitude: stationInfo?.lon ?? "",
        temp_c: tempDewMatch ? Number(tempDewMatch[1]) : "",
        dewpoint_c: tempDewMatch ? Number(tempDewMatch[2]) : "",
        wind_dir_degrees,
        wind_speed_kt,
        wind_gust_kt,
        visibility_statute_mi: visMiles,
        altim_in_hg: altimMatch ? (Number(altimMatch[1]) / 100).toFixed(2) : "",
        sky_condition,
        flight_category: cond, 
        metar_type,
        elevation_m: stationInfo?.elevation_m ?? "",
        forecast: forecast,
    };

    try {
        stateCache.messages.set(location, output);
    }
    finally {}

    return output;
}

async function attachAirportInfo(station) {
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

/**
 * Parses a TAF Data string into forecast periods with wind, visibility, and sky conditions
 * @param {string} tafData - Raw TAF Data string
 * @returns {Array} Array of forecast objects
 */
function parseWeatherForecast(tafData) {
    // Split into lines/periods
    const lines = tafData
        .replace(/\n/g, ' ')
        .replace(/=+$/, '')
        .split(/(?=\bFM\d{6}|TEMPO|PROB\d{2}|BECMG)/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const forecastPeriods = [];

    for (const line of lines) {
        const normalizedLine = line.replace(/\s+/g, ' ').trim();
        // Identify type
        let type = "MAIN";
        let time = null;
        let match;

        if (normalizedLine.startsWith("FM")) {
            type = "FM";
            match = normalizedLine.match(/^FM(\d{6})/);
            time = match ? match[1] : null;
        } else if (normalizedLine.startsWith("TEMPO")) {
            type = "TEMPO";
            match = normalizedLine.match(/^TEMPO\s+(\d{4})\/(\d{4})/);
            time = match ? { from: match[1], to: match[2] } : null;
        } else if (normalizedLine.startsWith("PROB")) {
            type = "PROB";
            match = normalizedLine.match(/^PROB(\d{2})\s+(\d{4})\/(\d{4})/);
            time = match ? { prob: match[1], from: match[2], to: match[3] } : null;
        } else if (normalizedLine.startsWith("BECMG")) {
            type = "BECMG";
            match = normalizedLine.match(/^BECMG\s+(\d{4})\/(\d{4})/);
            time = match ? { from: match[1], to: match[2] } : null;
        }

        // Parse wind, visibility, and sky conditions
        // Use matchAll to find the first wind group in each line
        let wind_dir_degrees = "";
        let wind_speed_kt = "";
        let wind_gust_kt = "";
        const windRegexGlobal = /(\d{3})(\d{2})G?(\d{2})?KT/g;
        let windMatchArr = [...normalizedLine.matchAll(windRegexGlobal)];
        if (windMatchArr.length > 0) {
            let windMatch = windMatchArr[0];
            wind_dir_degrees = Number(windMatch[1]);
            wind_speed_kt = Number(windMatch[2]);
            wind_gust_kt = windMatch[3] ? Number(windMatch[3]) : "";
        } else {
            // console.log(`NO WIND MATCH FOR TAF: ${tafData}`);
        }

        const visRegex = /(\d{1,2})SM/;
        const visMatch = line.match(visRegex);

        // Sky conditions
        let sky_condition = [];
        const skyRegex = /(FEW|SCT|BKN|OVC)(\d{3})/g;
        let skyMatch;
        while ((skyMatch = skyRegex.exec(line)) !== null) {
            sky_condition.push({
                sky_cover: skyMatch[1],
                cloud_base_ft_agl: String(Number(skyMatch[2]) * 100)
            });
        }

        forecastPeriods.push({
            type,
            time,
            text: line,
            wind_dir_degrees,
            wind_speed_kt,
            wind_gust_kt,
            visibility_statute_mi: visMatch ? Number(visMatch[1]) : "",
            sky_condition
        });
    }

    return forecastPeriods;
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
