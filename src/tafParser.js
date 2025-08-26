// tafParser.js
// Handles TAF and TAF.AMD parsing
import { attachAirportInfo } from './airportInfo.js';
import { weatherAcronymKeymap, skyAndConditionsKeymap } from '/keymaps.js';

export async function parseTafData(tafJson) {
    if (!tafJson || !tafJson.Data) return null;
    let data = tafJson.Data.replace(/\n/g, ' ').replace(/=+$/, '').trim();

    const periodMatch = data.match(/(\d{4}\/\d{4})/);
    const changeIndicators = [...data.matchAll(/(FM\d{6}|PROB\d{2}|TEMPO|BECMG)/g)].map(m => m[1]);
    const windMatches = [...data.matchAll(/(\d{3})(\d{2,3})(KT)/g)];
    const wind = windMatches.map(match => `${match[1]} ${match[2]} ${match[3]}`);
    const visibilityMatches = [...data.matchAll(/(\d{1,2})\s?(SM|P6SM)/g)];
    const visibility = visibilityMatches.map(match => `${match[1]} ${match[2]}`);
    const skyMatches = [...data.matchAll(/(FEW\d{3}|SCT\d{3}|BKN\d{3}|OVC\d{3}|BKN\d{3}CB)/g)];
    const sky = skyMatches.map(code => code[0]);

    const wxMatches = [...data.matchAll(/\b([A-Z]{2,6})\b/g)].map(m => m[1])
        .filter(code => weatherAcronymKeymap[code]);
    const wxDescriptions = wxMatches.map(code => weatherAcronymKeymap[code]);

    const airportInfo = await attachAirportInfo(tafJson.Location);

    let outObject = {
        type: tafJson.Type || 'TAF',
        station: tafJson.Location,
        airport: airportInfo,
        lat: (airportInfo && airportInfo.latitude != null) ? airportInfo.latitude : null,
        lon: (airportInfo && airportInfo.longitude != null) ? airportInfo.longitude : null,
        time: tafJson.Time,
        period: periodMatch ? periodMatch[1] : null,
        changeIndicators,
        wind,
        visibility,
        sky,
        weather: wxMatches,
        weatherDescription: wxDescriptions,
        airport: airportInfo,
        raw: data
    };

    return outObject;
}

export async function parseTafAmdData(tafJson) {
    if (!tafJson || !tafJson.Data) return null;
    let data = tafJson.Data.replace(/\n/g, ' ').replace(/=+$/, '').trim();

    const periodMatch = data.match(/(\d{4}\/\d{4})/);
    const changeIndicators = [...data.matchAll(/(FM\d{6}|PROB\d{2}|TEMPO|BECMG)/g)].map(m => m[1]);
    const windMatches = [...data.matchAll(/(\d{3})(\d{2,3})(KT)/g)];
    const wind = windMatches.map(match => `${match[1]} ${match[2]} ${match[3]}`);
    const visibilityMatches = [...data.matchAll(/(\d{1,2})\s?(SM|P6SM)/g)];
    const visibility = visibilityMatches.map(match => `${match[1]} ${match[2]}`);
    const skyMatches = [...data.matchAll(/(FEW\d{3}|SCT\d{3}|BKN\d{3}|OVC\d{3}|BKN\d{3}CB)/g)];
    const sky = skyMatches.map(code => code[0]);

    const wxMatches = [...data.matchAll(/\b([A-Z]{2,6})\b/g)].map(m => m[1])
        .filter(code => weatherAcronymKeymap[code]);
    const wxDescriptions = wxMatches.map(code => weatherAcronymKeymap[code]);

    const airportInfo = await attachAirportInfo(tafJson.Location);

    return {
        type: tafJson.Type || 'TAF.AMD',
        station: tafJson.Location,
        airport: airportInfo,
        lat: (airportInfo && airportInfo.lat != null) ? airportInfo.lat : "",
        lon: (airportInfo && airportInfo.lon != null) ? airportInfo.lon : "",
        time: tafJson.Time,
        period: periodMatch ? periodMatch[1] : null,
        changeIndicators,
        wind,
        visibility,
        sky,
        weather: wxMatches,
        weatherDescription: wxDescriptions,
        airport: airportInfo,
        raw: data
    };
}
