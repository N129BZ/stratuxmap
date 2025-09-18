// svgMetar.js
// Contains all code relevant to generating SVG objects from METAR data

// --- Cloud abbreviation map ---
import { CLOUDS, WEATHER, CONDITIONS } from "./weatherdictionary.js";

const GUST_WIDTH = 5;
const WS_WIDTH = 5;

// --- SVG generation functions ---
function genCoverage(coverage, condition) {
    if (coverage != null && coverage !== "") {
        return `\n            <style>\n                .coverage{ \n                    stroke-width: 5; \n                    stroke: ${condition != null ? CONDITIONS[condition] : "black"};\n                }\n                .partial{\n                    stroke-width: 25; \n                    stroke: ${condition != null ? CONDITIONS[condition] : "black"};\n                }\n                .ovc{\n                    fill: ${condition != null ? CONDITIONS[condition] : "black"};\n                }\n            </style>\n            ${CLOUDS[coverage].svg}`;
    } else {
        return "";
    }
}

function getWeatherSVG(key) {
    const weather = WEATHER[key] != null ? WEATHER[key].svg : "";
    return `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"65\" height=\"65\" viewBox=\"0 0 500 500\" x=\"140\" y=\"220\">\n                <style>\n                    .wx_text{ \n                        color: black;\n                        font-size: 400px;\n                        font-family: 'Noto Sans';\n                        white-space: pre;\n                    }\n                    .snow{ \n                        color: black;\n                        font-size: 300px;\n                        font-family: 'Noto Sans';\n                        white-space: pre;\n                    }\n                    .wx_graphic {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 30\n                    }\n                    .wx_graphic_thin {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 15\n                    }\n                </style>\n                ${weather}\n            </svg>`;
}

/**
 * Creates a windbarb for the metar
 * @param metar
 * @returns
 */
function genWind(metar) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var WDD = metar.wind_direction ? metar.wind_direction : 0;
    var WSP = metar.wind_speed ? metar.wind_speed : 0;
    var WGSP = metar.gust_speed ? metar.gust_speed : 0;
    var wind = "";
    var gust = "";
    if (WSP === 0) {
        wind =
            `<g id="calm"><ellipse id="calm-marker" stroke="#000" fill="#00000000" cx="250" cy="250" rx="35" ry="35"/></g>`;
    }
    else {
        gust = (metar.gust_speed === null || metar.gust_speed === undefined) ? "" :
            `<g id="gustBarb" transform="rotate(${WDD}, 250, 250)"> ` +
                `${genBarb1((_a = WGSP) !== null && _a !== void 0 ? _a : 0, true)} ` + 
                `${genBarb2((_b = WGSP) !== null && _b !== void 0 ? _b : 0, true)} ` + 
                `${genBarb3((_c = WGSP) !== null && _c !== void 0 ? _c : 0, true)} ` + 
                `${genBarb4((_d = WGSP) !== null && _d !== void 0 ? _d : 0, true)} ` + 
                `${genBarb5((_e = WGSP) !== null && _e !== void 0 ? _e : 0, true)} ` + 
            `</g>`;
        wind =
            `<g id="windBarb" transform="rotate(${WDD}, 250, 250)">` + 
            `<line stroke-width="5" y1="225" x1="250" y2="90" x2="250" stroke="#000" fill="none"/>` +
                `${genBarb1((_f = WSP) !== null && _f !== void 0 ? _f : 0, false)} ` + 
                `${genBarb2((_g = WSP) !== null && _g !== void 0 ? _g : 0, false)} ` + 
                `${genBarb3((_h = WSP) !== null && _h !== void 0 ? _h : 0, false)} ` + 
                `${genBarb4((_j = WSP) !== null && _j !== void 0 ? _j : 0, false)} ` + 
                `${genBarb5((_k = WSP) !== null && _k !== void 0 ? _k : 0, false)} ` + 
            `</g>`;
    }
    return gust + wind;
}

function metarToSVG(metar, width, height) {
    var _a, _b, _c, _d, _e, _f;
    var VIS = (_a = metar.visiblity) !== null && _a !== void 0 ? _a : "";
    var TMP = (_b = metar.temp) !== null && _b !== void 0 ? _b : "";
    var DEW = (_c = metar.dew_point) !== null && _c !== void 0 ? _c : "";
    var STA = (_d = metar.station) !== null && _d !== void 0 ? _d : "";
    var ALT = (_e = metar.pressure) !== null && _e !== void 0 ? _e : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 500 500"> ` +
           `<style> ` + 
                `.txt{ font-size: 47.5px; font-family: sans-serif; } ` +
                `.tmp{ fill: red } ` + 
                `.sta{ fill: grey } ` + 
                `.dew{ fill: blue } ` +
                `.vis{ fill: violet } ` +
           `</style> ${(0, genWind)(metar)} ${(0, getWeatherSVG)((_f = metar.wx) !== null && _f !== void 0 ? _f : "")} ` +
           `         ${(0, genCoverage)(metar.coverage, metar.condition)} ` + 
           `<g id="text"><text class="vis txt" fill="#000000" stroke="#000" stroke-width="0" x="80" y="260" text-anchor="middle" ` +
           `xml:space="preserve">${VIS}</text><text class="tmp txt" fill="#000000" stroke="#000" stroke-width="0" x="160" y="220" text-anchor="middle" ` +
           `xml:space="preserve">${TMP}</text><text class="dew txt" fill="#000000" stroke="#000" stroke-width="0" x="160"  y="315" text-anchor="middle" ` +
           `xml:space="preserve">${DEW}</text><text class="sta txt" fill="#000000" stroke="#000" stroke-width="0" x="275"  y="315" text-anchor="start" ` +
           `xml:space="preserve">${STA}</text><text class="sta txt" fill="#000000" stroke="#000" stroke-width="0" x="275"  y="220" text-anchor="start" ` +
           `xml:space="preserve">${ALT}</text></g></svg>`;
}

function getWindBarbSvg(metarObject, width, height) {
    let catcolor = "";
    let svg = "";
    let thismetar = {
        wind_direction: metarObject.wind?.direction,
        wind_speed: metarObject.wind?.speed,
        gust_speed: metarObject.wind?.gust,
        station: metarObject.station,
        flight_category: metarObject.category // <-- use camelCase consistently
    };

    switch (metarObject.category) {
        case "IFR":
            catcolor = "ff0000";
            break;
        case "LIFR":
            catcolor = "ff00ff";
            break;
        case "MVFR": 
            catcolor = "0000cd";
            break;
        case "VFR":
        default:
            catcolor = "12f23c";
            break;
    }
    svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" ` +
              `width=\"${width}\" height=\"${height}\" ` + 
              `viewBox=\"0 0 500 500\">` + 
              `${genWind(thismetar)}` + 
              `<g id=\"clr\">` + 
                   `<circle cx=\"250\" cy=\"250\" r=\"30\" stroke=\"#000000\" stroke-width=\"3\" fill=\"#${catcolor}\"/>` +
              `</g>` + 
           `</svg>`;
    return svg; 
}

/**
 * Generate first barb
 * @param speed wind or gust speed
 * @param gust set to true for gust
 * @returns
 */
function genBarb1(speed, gust) {
    var fill = gust ? 'red' : '#000';
    var tag = gust ? 'gs' : 'ws';
    var width = gust ? GUST_WIDTH : WS_WIDTH;
    var barb = "";
    if (speed >= 10 && speed < 50) {
        barb = `<line id="${tag}-barb-1-long" stroke-width="${width}" y1="90" x1="250" y2="90" x2="305" stroke="${fill}" transform="rotate(-35, 250, 90)"/>`;
    }
    else if (speed >= 50) {
        barb = `<polygon id="${tag}-barb-1-flag" points="248,98 290,68 248,68" fill="${fill}" />`;
    }
    return barb;
}
function genBarb2(speed, gust) {
    var fill = gust ? 'red' : '#000';
    var tag = gust ? 'gs' : 'ws';
    var width = gust ? GUST_WIDTH : WS_WIDTH;
    var barb = "";
    if ((speed < 10) || (15 <= speed && speed < 20) || (55 <= speed && speed < 60)) {
        barb = `<line id="${tag}-barb-2-short" stroke-width="${width}" y1="110" x1="250" y2="110" x2="285" stroke="${fill}" transform="rotate(-35, 250, 110)"/>`;
    }
    else if ((15 < speed && speed < 50) || (speed >= 60)) {
        barb = `<line id="${tag}-barb-2-long" stroke-width="${width}" y1="110" x1="250" y2="110" x2="305" stroke="${fill}" transform="rotate(-35, 250, 110)"/>`;
    }
    return barb;
}
function genBarb3(speed, gust) {
    var fill = gust ? 'red' : '#000';
    var tag = gust ? 'gs' : 'ws';
    var width = gust ? GUST_WIDTH : WS_WIDTH;
    var barb = "";
    if ((25 <= speed && speed < 30) || (65 <= speed && speed < 70)) {
        barb = `<line id="${tag}-barb-3-short" stroke-width="${width}" y1="150"  x1="250" y2="150" x2="285" stroke="${fill}" transform="rotate(-35, 250, 150)"/>`;
    }
    else if ((25 < speed && speed < 50) || speed >= 70) {
        barb = `<line id="${tag}-bard-3-long" stroke-width="${width}" y1="150"  x1="250" y2="150" x2="305" stroke="${fill}" transform="rotate(-35, 250, 150)"/>`;
    }
    return barb;
}
function genBarb4(speed, gust) {
    var fill = gust ? 'red' : '#000';
    var tag = gust ? 'gs' : 'ws';
    var width = gust ? GUST_WIDTH : WS_WIDTH;
    var barb = "";
    if ((35 <= speed && speed < 40) || (75 <= speed && speed < 80)) {
        barb = `<line id="${tag}-barb-4-short" stroke-width="${width}" y1="190" x1="250" y2="190" x2="285" stroke="${fill}" transform="rotate(-35, 250, 190)"/>`;
    }
    else if ((35 < speed && speed < 50) || speed >= 80) {
        barb = `<line id="${tag}-barb-4-long" stroke-width="${width}" y1="190" x1="250" y2="190" x2="305"  stroke="${fill}" transform="rotate(-35, 250, 190)"/>`;
    }
    return barb;
}
function genBarb5(speed, gust) {
    var fill = gust ? 'red' : '#000';
    var tag = gust ? 'gs' : 'ws';
    var width = gust ? GUST_WIDTH : WS_WIDTH;
    var barb = "";
    if ((45 <= speed && speed < 50) || (85 <= speed && speed < 90)) {
        barb = `<line id="${tag}-barb-5-short" stroke-width="${width}" y1="230" x1="250" y2="230" x2="285" stroke="${fill}" transform="rotate(-35, 250, 230)"/>`;
    }
    return barb;
}

function cToF(celsius) {
    return Math.round((celsius * 9 / 5 + 32) * 100) / 100;
}

function milePrettyPrint(mile) {
    if (mile === 9999) {
        return "10";
    }
    else {
        return (mile / 1000).toString();
    }
}

/**
 * Convert METAR object with raw values to SVG
 * @param metarObject
 * @param width
 * @param height
 * @param metric
 * @returns
 */
function rawMetarToSVG(metarObject, width, height, metric) {
    var plot = rawMetarToMetarPlot(metarObject, metric);
    return metarToSVG(plot, width, height);
}

/**
 * Convert METAR object with raw values to METAR plot object
 * @param metarObject
 * @param metric
 * @returns
 */
function rawMetarToMetarPlot(metarObject, metric) {
    var _a;
    // Use the JSON object directly, no METAR class
    var wx = metarObject.weather ? metarObject.weather.map(function (weather) { return weather.abbreviation; }).join("") : "";
    //Metric conversion
    var pressure;
    var vis = metarObject.visibility;
    var temp = metarObject.temperature;
    var dp = metarObject.dewpoint;
    if (metric) {
        pressure = metarObject.altimeter ? Math.round(metarObject.altimeter * 33.86) : undefined;
        if (metarObject.visibility.distance) {
            vis = metarObject.visibility.distance > 9999 ? 9999 : Math.round(metarObject.visibility.distance);
        }
    }
    else {
        temp = cToF(temp);
        dp = cToF(dp);
        pressure = metarObject.altimeter;
        if (metric) {
            vis = milePrettyPrint((_a = metarObject.visibility.distance) !== null && _a !== void 0 ? _a : -1);
        }
    }
    
    let outobj = {
        metric: metric !== null && metric !== void 0 ? metric : false,
        visiblity: typeof vis === "number" || typeof vis === "string" ? vis : "",
        temp: typeof temp === "number" || typeof temp === "string" ? temp : "",
        dew_point: typeof dp === "number" || typeof dp === "string" ? dp : "",
        station: metarObject.station || "",
        wind_direction: typeof metarObject.wind.direction === "number" ? metarObject.wind.direction : "",
        wind_speed: typeof metarObject.wind.speed === "number" ? metarObject.wind.speed : "",
        gust_speed: typeof metarObject.wind.gust === "number" ? metarObject.wind.gust : "",
        wx: wx,
        pressure: typeof pressure === "number" ? pressure : "",
        coverage: metarObject.clouds ? determineCoverage(metarObject) : "",
        condition: parseCondition(metarObject) ? metarObject.flightCategory : ""
    };

    return outobj;
}

function parseCondition(metarObject) {
    let visMiles = metarObject.visibility.distance; 
    let ceiling = null;
    let cond = "VFR";

    if (metarObject.clouds && metarObject.clouds.length > 0) {
        // Find lowest cloud base (exclude SKC, CLR, NSC, FEW, SCT)
        const coverRanks = { BKN: 3, OVC: 4, VV: 5 };
        let lowest = metarObject.clouds
            .filter(c => coverRanks[c.abbreviation])
            .map(c => c.altitude)
            .sort((a, b) => a - b)[0];

        ceiling = lowest || null;
    }
    
    if ((visMiles !== null && visMiles < 1)) cond = "LIFR";
    if ((visMiles !== null && visMiles < 3)) cond = "IFR";
    if ((visMiles !== null && visMiles < 5)) cond = "MVFR";
    
    metarObject.condition = cond;

    return true;
}

function determineCoverage(weatherObject) {
    var _a;
    var prevailingCoverage;
    weatherObject.clouds.forEach(function (cloud) {
        if (prevailingCoverage != null) {
            var curr = prevailingCoverage.abbreviation != null ? CLOUDS[prevailingCoverage.abbreviation].rank : undefined;
            var rank = cloud.abbreviation != null ? CLOUDS[cloud.abbreviation].rank : undefined;
            if (rank != null) {
                if (rank > curr) {
                    prevailingCoverage = cloud;
                }
            }
        }
        else {
            prevailingCoverage = cloud;
        }
    });
    return (_a = prevailingCoverage === null || prevailingCoverage === void 0 ? void 0 : prevailingCoverage.abbreviation) !== null && _a !== void 0 ? _a : "";
}

/**
 *
 * @param rawWxItem raw metar string
 * @param metric true for metric units(m, hPa, mps), false for north american units (miles, inHg, Kts)
 * @returns
 */
function weatherItemToIconPlot(weatherObject, metric) {
    var _a;
    var weather = weatherObject.weather || [];
    var wx = weather.map(function (weather) { return weather.abbreviation; }).join("");
    //Metric conversion
    var pressure;
    var vis;
    var temp = weatherObject.temperature;
    var dp = weatherObject.dewpoint_c;
    if (metric) {
        pressure = (weatherObject.altimeter != null) ? Math.round(weatherObject.altimeter * 33.86) : undefined;
        if (weatherObject.visibility != null) {
            vis = weatherObject.visibility > 9999 ? 9999 : Math.round(weatherObject.visibility);
        }
    }
    else {
        temp = cToF(temp);
        dp = cToF(dp);
        pressure = weatherObject.altimeter;
        vis = milePrettyPrint((_a = weatherObject.visibility) !== null && _a !== void 0 ? _a : -1);
    }
    return {
        metric: metric !== null && metric !== void 0 ? metric : false,
        visiblity: vis,
        temp: temp,
        dew_point: dp,
        station: weatherObject.station,
        wind_direction: (typeof weatherObject.wind.direction === "number") ? weatherObject.wind.direction : undefined,
        wind_speed: weatherObject.wind.speed,
        gust_speed: weatherObject.wind.gust,
        pressure: pressure,
        wx: wx,
        coverage: determineCoverage(weatherObject)
    };
}

// Export functions and maps (ES6 module format)
export {
    parseCondition,
    genCoverage,
    getWeatherSVG,
    genWind,
    metarToSVG,
    getWindBarbSvg,
    rawMetarToSVG,
    rawMetarToMetarPlot,
    weatherItemToIconPlot,
    milePrettyPrint
}