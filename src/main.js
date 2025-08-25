'use strict';

import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import './style.css';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Overlay from 'ol/Overlay';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import LayerSwitcher from 'ol-layerswitcher';
import { parseWeatherMessage } from './messageparser';
import { formatMessageDisplay } from './messagedisplay';
import settings from '/settings.js';

const URL_GET_AIRPORTLIST = `http://localhost:8500/airportlist`;

const urlsituation = "ws://127.0.0.1/situation";
const urltraffic = "ws://127.0.0.1/traffic";
const urlweather = "ws://127.0.0.1:6090"; ///weather";

let airports = {};
let ownshipLayer;
let last_longitude = 0.0;
let last_latitude = 0.0;

/**
 * Controls for dropdown select when viewing all airports
 */
const regioncontrol = document.getElementById('isoregion');
const regionselect = document.getElementById("regionselect");
const airplaneImg = document.createElement('img');
airplaneImg.src = '/images/airplane.png';
airplaneImg.width = 30;
airplaneImg.height = 30;

let DistanceUnits = {};
let distanceunit = "";
let viewposition = fromLonLat([last_longitude, last_latitude]);

document.addEventListener('click', function(e) {
    const target = e.target.closest(".ol-popup"); 
    if (target) {
        closePopup();
    }
});


/**
 * The scale of miles shown on lower left corner of map
 */
const scaleLine = new ScaleLine({
    units: 'imperial',
    bar: true,
    steps: 4,
    minWidth: 140
});

let regionmap = new Map();
setupStratuxWebsockets();

/**
 * Map objects used for various keyname lookups
 */
let airportNameKeymap = new Map();

    
function parseFlightCategory() {
    let vis = this.visibility; // in meters, convert to miles
    let cond = "VFR" // default
    let ceiling = null;
    if (this.clouds.length > 0) {
        // Find lowest cloud base (exclude SKC, CLR, NSC, FEW, SCT)
        const coverRanks = { BKN: 3, OVC: 4, VV: 5 };
        let lowest = this.clouds
            .filter(c => coverRanks[c.abbreviation])
            .map(c => c.altitude)
            .sort((a, b) => a - b)[0];

        ceiling = lowest || null;
    }
    // Convert visibility to statute miles if needed
    let vis_miles = vis ? vis * 0.000621371 : null;
    if ((ceiling !== null && ceiling < 500) || (vis_miles !== null && vis_miles < 1)) cond = "LIFR";
    if ((ceiling !== null && ceiling < 1000) || (vis_miles !== null && vis_miles < 3)) cond = "IFR";
    if ((ceiling !== null && ceiling < 3000) || (vis_miles !== null && vis_miles < 5)) cond = "MVFR";
    this.flightCategory = cond;
    switch (cond) {
        case "MVFR":
            this.color = "#0000ff";
            break;
        case "IFR":
            this.color = "#ff0000";
            break;
        case "MIFR":
            this.color = "#ff00ff";
            break;
        case "VFR":
        default:
            this.color = "#10cf20";
            break;
    } 
    return cond;
}

class Wind {
    constructor() {
        this.direction = 0;
        this.speed = 0;
        this.gustspeed = 0;
        this.unit = "";
    }
};
class Variation {
    constructor() {}
};
class Cloud {
    constructor() {}
};


/**
 * The map object that gets put in index.html <div> element
 */
const map = new OLMap({
    target: 'map',
    view: new View({
        center: viewposition,        
        zoom: settings.startupzoom,
        enableRotation: false,
        minZoom: 1,
        maxZoom: 22
    }),
    layers: [
        new TileLayer({
            source: new OSM()
        })
    ],
    controls: defaultControls().extend([scaleLine])
    //overlays: [popupoverlay]
});

const layerSwitcher = new LayerSwitcher({
    tipLabel: 'Layers', 
    groupSelectStyle: 'children'
});
map.addControl(layerSwitcher);


/**
 * Icon markers for airports, TAFs, heliports, etc.
 */

/*--------------------------------------*/
let airportMarker = new Icon({
    crossOrigin: 'anonymous',
    src: '/images/dot.png',
    size: [55, 55],
    offset: [0, 0],
    opacity: 1,
    scale: .30
});



let metarVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "Metars",
    visible: false,
    zIndex: 12
});

let viewextent = [-180, -85, 180, 85];
let offset = [-18, -18];
let extent = transformExtent(viewextent, 'EPSG:4326', 'EPSG:3857')

let airportVectorLayer = new VectorLayer({
    source: new VectorSource(), 
    title: "All Airports",
    visible: false,
    zIndex: 11
}); 

let tafVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "TAFs",
    visible: true,
    zIndex: 13
});

let pirepVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "Pireps",
    visible: true,
    zIndex: 14
});

map.addLayer(metarVectorLayer);
map.addLayer(tafVectorLayer);
map.addLayer(pirepVectorLayer);
map.addLayer(airportVectorLayer);

async function setupStratuxWebsockets() {
    let wsTraffic = new WebSocket(urltraffic);
    wsTraffic.onmessage = function(evt){
        let data = JSON.parse(evt.data);
        console.log(data);
    }

    let wsSituation = new WebSocket(urlsituation);
    wsSituation.onmessage = function(evt){
        let data = JSON.parse(evt.data);
        setOwnshipOrientation(data);
        //console.log(data);
    }

    let wsWeather = new WebSocket(urlweather);
    wsWeather.onmessage = function(evt) {
        let data = JSON.parse(evt.data);
        console.log(data)
        parseWeatherMessage(data);
    };
}

function findAirportByICAO(icao) {
    let response = {};
    response = airports.find(airport => airport.ident === icao);
    return response;     
}

function placeOwnshipOnMap(jsondata) {
    const coords = fromLonLat([jsondata.GPSLongitude, jsondata.GPSLatitude]);
    const pointFeature = new Feature({
        geometry: new Point(coords)
    });

    pointFeature.setStyle(new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'red' }),
            stroke: new Stroke({ color: 'black', width: 1 })
        })
    }));

    // Create a vector source and layer if not already present
    if (!ownshipLayer) {
        ownshipLayer = new VectorLayer({
            source: new VectorSource(),
        });
        map.addLayer(ownshipLayer);
    }

    ownshipLayer.getSource().addFeature(pointFeature);
}


/**
 * Event to view Metar/TAF popup & closure
 */
map.on('click', (evt) => {
    let hasfeature = false;
    let coords = toLonLat(evt.coordinate);
    
    map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        if (feature) {
            hasfeature = true;
            let datatype = feature.get("datatype");
            if (datatype === "metar") {
                displayMetarPopup(feature);
            }
            else if (datatype === "taf"){
                displayTafPopup(feature);
            }
            else if (datatype === "pirep") {
                displayPirepPopup(feature);
            }
            else if (datatype === "airport") { // simple airport marker
                //displayAirportPopup(feature);
            }
            else if (datatype === "traffic") {
                //BAMHERE
                //displayTrafficPopup(feature);
            }
            let coordinate = evt.coordinate;
            popupoverlay.setPosition(coordinate);
        }
    });
    if (!hasfeature) {
        closePopup();
    }
});

/**
 * Create the html for a METAR popup element
 * @param {feature} ol.Feature: the metar feature the user clicked on 
 */
function displayMetarPopup(feature) {
    
}

/**
 * Create the html for a TAF popup element
 * @param {feature} ol.Feature: the taf feature the user clicked on
 */
function displayTafPopup(feature) {

}

/**
 * Create the html for a PIREP popup element
 * @param {object} feature: the pirep the user clicked on
 */
function displayPirepPopup(feature) {
 
}

/**
 * Takes a raw WeatherItem outputs an SVG image
 * @param wxitem RAW WeatherItem string
 * @param width css width of svg
 * @param height css height of svg
 * @param metric true for metric units(m, hPa, mps), false for north american units (miles, inHg, Kts)
 * @returns svg image
 */
function weatherItemToSVG(wxitem, width, height, metric) {
    let plot = weatherItemToIconPlot(wxitem, metric);
    let svg = weatherItemIconPlotToSVG(plot, width, height);
    return svg;
}

/**
 * Metar popup objects
 */
const popup = document.getElementById('popup');
const popupcontent = document.getElementById('popup-content');
const popupoverlay = new Overlay({
    element: popup,
    autoPan: true,
    autoPanAnimation: {
      duration: 500,
    },
});
map.addOverlay(popupoverlay);

/**
 * popup close event handler
 * @returns false!!
 */
function closePopup() {
    popupoverlay.setPosition(undefined);
    return false;s
}

/**
 *
 * @param rawWxItem raw metar string
 * @param metric true for metric units(m, hPa, mps), false for north american units (miles, inHg, Kts)
 * @returns
 */
function weatherItemToIconPlot(wxItem, metric) {
    var _a;
    //Metric converion
    var pressure;
    var vis = undefined;
    var temp = wxItem.temp_c;
    var dp = wxItem.dewpoint_c;
    if (metric) {
        pressure = (wxItem.altimeter != null) ? Math.round(wxItem.altimeter * 33.86) : undefined;
        if (wxItem.visibility != null) {
            vis = wxItem.visibility > 9999 ? 9999 : Math.round(wxItem.visibility);
        }
    }
    else {
        temp = cToF(temp);
        dp = cToF(dp);
        pressure = wxItem.altimeter;
        vis = milePrettyPrint((_a = wxItem.visibility) !== null && _a !== void 0 ? _a : -1);
    }
    return {
        metric: metric !== null && metric !== void 0 ? metric : false,
        visiblity: vis,
        temp: temp,
        dew_point: dp,
        station: wxItem.station,
        wind_direction: (typeof wxItem.wind.direction === "number") ? wxItem.wind.direction : undefined,
        wind_speed: wxItem.wind.speed,
        gust_speed: wxItem.wind.gust,
        pressure: pressure,
        wx: {},
        coverage: determineCoverage(wxItem)
    };
}

/**
 * Pretty print Miles in fractions if under 1 mile
 */
function milePrettyPrint(meters) {
    var print = "";
    if (meters === -1) {
        return print;
    }
    var miles = meters * 0.0006213712;
    //round to nearest quarter
    var text = (Math.round(miles * 4) / 4).toFixed(2).toString();
    return text.replace(".00", "");
}

/**
 * Determines the coverage symbol
 * @param wxitem
 * @returns
 */
function determineCoverage(wxitem) {
    var _a;
    var prevailingCoverage;
    wxitem.clouds.forEach(function (cloud) {
        if (prevailingCoverage != null) {
            var curr = prevailingCoverage.abbreviation != null ? CLOUDS[prevailingCoverage.abbreviation].rank : undefined;
            var rank = cloud.abbreviation != null ? CLOUDS[cloud.abbreviation].rank : undefined;
            //console.log("cur: " + curr + ", rank: " + rank);
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

const CONDITIONS = {
    VFR: "green",
    MVFR: "blue",
    IFR: "red",
    LIFR: "purple"
};

var size = 25;
var piD = (size / 2) * 3.14 * 2;
var CLR_SQUARE = "<g id=\"clr\">\n        <rect width=\"" + size + "\" height=\"" + size + "\" x=\"calc(250 - " + size / 2 + ")\" y=\"calc(250 - " + size / 2 + ")\" class=\"coverage\"/>\n    </g>";
var CLR_CIRCLE = "<g id=\"clr\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    </g>";
var FEW = "<g id=\"few\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n        <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n        stroke-dasharray=\"0 calc(75 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n        class=\"partial\"/>\n    </g>";
var SCT = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(25 * " + piD + " / 100) calc(50 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
var BRK = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(49 * " + piD + " / 100) calc(26 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
var OVC = "<g id=\"ovc\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" class=\"ovc\"/>\n</g>";
let CLOUDS = {
    NCD: { svg: CLR_CIRCLE, text: "no clouds", rank: 0 },
    SKC: { svg: CLR_CIRCLE, text: "sky clear", rank: 0 },
    CLR: { svg: CLR_CIRCLE, text: "no clouds under 12,000 ft", rank: 0 },
    NSC: { svg: CLR_CIRCLE, text: "no significant", rank: 0 },
    FEW: { svg: FEW, text: "few", rank: 1 },
    SCT: { svg: SCT, text: "scattered", rank: 2 },
    BKN: { svg: BRK, text: "broken", rank: 3 },
    OVC: { svg: OVC, text: "overcast", rank: 4 },
    VV: { svg: OVC, text: "vertical visibility", rank: 5 },
};

/**
 * Generates SVG for cloud coverage
 * @param coverage
 * @param condition
 * @returns
 */
function genCoverage(coverage, condition) {
    if (coverage != null && coverage !== "") {
        return "\n            <style>\n                .coverage{ \n                    stroke-width: 5; \n                    stroke: " + (condition != null ? exports.CONDITIONS[condition] : "black") + ";\n                }\n                .partial{\n                    stroke-width: 25; \n                    stroke: " + (condition != null ? exports.CONDITIONS[condition] : "black") + ";\n                }\n                .ovc{\n                    fill: " + (condition != null ? exports.CONDITIONS[condition] : "black") + ";\n                }\n            </style>\n            " + CLOUDS[coverage].svg;
    }
    else {
        return "";s
    }
}

var RVR = /** @class */ (function () {
    function RVR(rvrString) {
        this.re = /(R\d{2})([L|R|C])?(\/)([P|M])?(\d+)(?:([V])([P|M])?(\d+))?([N|U|D])?(FT)?/g;
        var matches;
        while ((matches = this.re.exec(rvrString)) != null) {
            if (matches.index === this.re.lastIndex) {
                this.re.lastIndex++;
            }
            this.runway = matches[1];
            this.direction = matches[2];
            this.seperator = matches[3];
            this.minIndicator = matches[4];
            this.minValue = matches[5];
            this.variableIndicator = matches[6];
            this.maxIndicator = matches[7];
            this.maxValue = matches[8];
            this.trend = matches[9];
            this.unitsOfMeasure = matches[10];
        }
    }
    return RVR;
}());

/**
 * Weather Descriptor
 */
var Weather = /** @class */ (function () {
    function Weather() {
    }
    return Weather;
}());

function getMetarColor(metar) {
    switch (metar.flightCategory) {
        case "MVFR": 
            return "#0000ff";
        case "IFR":
            return "#FF0000";  
        case "LIFR": 
            return "#ff00ff"; 
        case "VFR":     
        default:
            return "#3ef04dff";
    }
}

/**
 * Turns a Metar plot object to a SVG image
 * @param wxitem MetarPlot Object
 * @param width css width for svg
 * @param height css height for svg
 * @returns
 */
 function weatherItemIconPlotToSVG(wxitem, width, height) {
    var _a, _b, _c, _d, _e, _f;
    var VIS = (_a = wxitem.visiblity) !== null && _a !== void 0 ? _a : "";
    var TMP = (_b = wxitem.temp) !== null && _b !== void 0 ? _b : "";
    var DEW = (_c = wxitem.dew_point) !== null && _c !== void 0 ? _c : "";
    var STA = (_d = wxitem.station) !== null && _d !== void 0 ? _d : "";
    var ALT = (_e = wxitem.pressure) !== null && _e !== void 0 ? _e : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 500 500"> ` +
           `<style> ` + 
                `.txt{ font-size: 47.5px; font-family: sans-serif; } ` +
                `.tmp{ fill: red } ` + 
                `.sta{ fill: grey } ` + 
                `.dew{ fill: blue } ` +
                `.vis{ fill: violet } ` +
           `</style> ${(0, genWind)(wxitem)} ${(0, getWeatherSVG)((_f = wxitem.wx) !== null && _f !== void 0 ? _f : "")} ` +
           `         ${(0, genCoverage)(wxitem.coverage, wxitem.condition)} ` + 
           `<g id="text"><text class="vis txt" fill="#000000" stroke="#000" stroke-width="0" x="80" y="260" text-anchor="middle" ` +
           `xml:space="preserve">${VIS}</text><text class="tmp txt" fill="#000000" stroke="#000" stroke-width="0" x="160" y="220" text-anchor="middle" ` +
           `xml:space="preserve">${TMP}</text><text class="dew txt" fill="#000000" stroke="#000" stroke-width="0" x="160"  y="315" text-anchor="middle" ` +
           `xml:space="preserve">${DEW}</text><text class="sta txt" fill="#000000" stroke="#000" stroke-width="0" x="275"  y="315" text-anchor="start" ` +
           `xml:space="preserve">${STA}</text><text class="sta txt" fill="#000000" stroke="#000" stroke-width="0" x="275"  y="220" text-anchor="start" ` +
           `xml:space="preserve">${ALT}</text></g></svg>`;
}

function getWeatherSVG(key) {
    var weather = WEATHER[key] != null ? WEATHER[key].svg : "";
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"65\" height=\"65\" viewBox=\"0 0 500 500\" x=\"140\" y=\"220\">\n                <style>\n                    .wx_text{ \n                        color: black;\n                        font-size: 400px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .snow{ \n                        color: black;\n                        font-size: 300px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .wx_graphic {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 30\n                    }\n                    .wx_graphic_thin {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 15\n                    }\n                </style>\n                " + weather + "\n            </svg>";
}

/**
 * Returns SVG icon
 * @param key weather abbriviation
 */
function getWeatherLegend(key) {
    var weather = WEATHER[key] != null ? WEATHER[key].svg : "";
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"65\" height=\"65\" viewBox=\"0 0 500 500\">\n                <style>\n                    .wx_text{ \n                        color: black;\n                        font-size: 400px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .snow{ \n                        color: black;\n                        font-size: 300px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .wx_graphic {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 30\n                    }\n                    .wx_graphic_thin {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 15\n                    }\n                </style>\n                " + weather + "\n            </svg>";
}
var BRK_DWN_ARW = "<line class=\"wx_graphic\" x1=\"350\" y1=\"50\" x2=\"175\" y2=\"250\"></line>\n    <line class=\"wx_graphic\" x1=\"170\" y1=\"245\" x2=\"350\" y2=\"415\"></line>\n    <line class=\"wx_graphic\" x1=\"350\" y1=\"415\" x2=\"250\" y2=\"415\"></line>\n    <line class=\"wx_graphic\" x1=\"350\" y1=\"425\" x2=\"350\" y2=\"315\"></line>";
var RIGHT_ARROW = "<line class=\"wx_graphic\" x1=\"120\" y1=\"250\" x2=\"430\" y2=\"250\"></line>\n    <line class=\"wx_graphic\" x1=\"380\" y1=\"250\" x2=\"465\" y2=\"250\" transform=\"rotate(-45, 450, 250)\"></line>\n    <line class=\"wx_graphic\" x1=\"380\" y1=\"250\" x2=\"450\" y2=\"250\" transform=\"rotate(45, 450, 250)\"></line>";
var TRANSFORM = "transform=\"matrix(1.4,0,0,1.2,-102.2,-30.3)\"";
var DWN_TRI = "<polygon style=\"stroke: black\" points=\"150 160 350 160 250 475\"></polygon>";
/*
SVG Icons
*/
//DUST OR SAND
var sine = "<path transform=\"matrix(1.4,0,0,1.6,-84,-118)\" style=\"fill: none; stroke: black; stroke-width: 10\" d=\"M 232.3 217.2 C 231.4 184.3 201 163.6 176.6 180.1 C 165.3 187.8 158.3 201.9 158.3 217.2\"></path>\n    <path transform=\"matrix(1.4,0,0,1.6,-121,-147)\" style=\"fill: none; stroke: black; stroke-width: 10\" d=\"M 337.1 223.5 C 337.1 255.3 304.1 275.2 277.8 259.3 C 265.6 251.9 258 238.2 258 223.5\"></path>    \n";
//Smoke or volcanic ash
var FU_VA = "<g id=\"FU_VA\">\n        <line class=\"wx_graphic\" x1=\"100\" y1=\"150\" x2=\"100\" y2=\"400\"></line>\n        <path class=\"wx_graphic\" d=\"M 100 150 C 115 75 185 75 200 150\"></path>\n        <path class=\"wx_graphic\" d=\"M 200 150 C 215 215 285 215 300 150\"></path>\n        <path class=\"wx_graphic\" d=\"M 300 150 C 315 75 380 75 400 150\"></path>\n    </g>";
//Haze
var HZ = "<g id=\"HZ\">\n        <text class=\"snow\" x=\"100\" y=\"365\">\u267E\uFE0F</text>\n    </g>";
//Dust or Sand
var DU_SA = "<g id=\"DU_SA\">\n        <text class=\"wx_text\" x=\"160\" y=\"360\">S</text>\n    </g>";
//Blowing dust or sand
var BLDU_BLSA = "<g id=\"BLDU_BLSA\">\n        <text class=\"wx_text\" x=\"160\" y=\"360\">$</text>\n    </g>";
//Dust Devil
var PO = "<g id=\"PO\">\n      <text class=\"wx_text\" style=\"font-size: 375px;\" x=\"50\" y=\"360\">(\u25CF)</text>\n    </g>";
//Vicinity sand storm
var VCSS = "<g id=\"VCSS\">\n        <text class=\"wx_text\" x=\"50\" y=\"360\">($)</text>\n        " + RIGHT_ARROW + "\n    </g>";
//FOG OR SPEACIAL WEATHER
//Mist or light fog
var BR = "<g id=\"BR\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"200\" x2=\"450\" y2=\"200\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"300\" x2=\"450\" y2=\"300\"></line>\n    </g>";
//More or less continuous shallow fog
var MIFG = "<g id=\"MIFG\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"200\" x2=\"200\" y2=\"200\"></line>\n        <line class=\"wx_graphic\" x1=\"300\" y1=\"200\" x2=\"450\" y2=\"200\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"300\" x2=\"450\" y2=\"300\"></line>\n    </g>\n    ";
//Vicinity thunderstorm
var VCTS = "<g id=\"VCTS\">" + BRK_DWN_ARW + "</g>";
//Virga or precipitation not hitting ground
var VIRGA = "<g id=\"VIGRA\">\n        <text transform=\"matrix(0, -1, 1, 0, 366, 389)\" class=\"wx_text\" style=\"font-size:300px;\" dx=\"-5 -9\" dy=\"-40 0.5\">(\u25CF</text>\n    </g>";
//Vicinity showers
var VCSH = "<g id=\"VCSS\">\n        <text class=\"wx_text\" x=\"50\" y=\"360\">( )</text>\n        <circle style=\"fill: black\" cx=\"230\" cy=\"260\" r=\"50\"></circle>\n    </g>";
//Thunderstorm with or without precipitation
var TS = "<g id=\"TS\">\n        " + BRK_DWN_ARW + "\n        <line class=\"wx_graphic\" x1=\"355\" y1=\"50\" x2=\"50\" y2=\"50\"></line>\n        <line class=\"wx_graphic\" x1=\"60\" y1=\"50\" x2=\"60\" y2=\"440\"></line>\n    </g>\n    ";
//Squalls
var SQ = "<g id=\"SQ\">\n        <line class=\"wx_graphic\" x1=\"250\" y1=\"450\" x2=\"150\" y2=\"50\"></line>\n        <line class=\"wx_graphic\" x1=\"150\" y1=\"50\" x2=\"250\" y2=\"125\"></line>\n        <line class=\"wx_graphic\" x1=\"250\" y1=\"125\" x2=\"350\" y2=\"50\"></line>\n        <line class=\"wx_graphic\" x1=\"350\" y1=\"50\" x2=\"250\" y2=\"450\"></line>\n    </g>";
//Funnel cloud or tornado
var FC = "<g id=\"FC\">\n        <line class=\"wx_graphic\" x1=\"200\" y1=\"100\" x2=\"200\" y2=\"400\"></line>\n        <line class=\"wx_graphic\" x1=\"300\" y1=\"100\" x2=\"300\" y2=\"400\"></line>\n        <line class=\"wx_graphic\" x1=\"300\" y1=\"100\" x2=\"375\" y2=\"50\"></line>\n        <line class=\"wx_graphic\" x1=\"300\" y1=\"400\" x2=\"375\" y2=\"450\"></line>\n        <line class=\"wx_graphic\" x1=\"200\" y1=\"400\" x2=\"125\" y2=\"450\"></line>\n        <line class=\"wx_graphic\" x1=\"200\" y1=\"100\" x2=\"125\" y2=\"50\"></line>\n    </g>\n    ";
//BLOWING WEATHER
//Sand or dust storm
var SS = "<g id=\"SS\">\n        <text class=\"wx_text\" x=\"160\" y=\"360\">S</text>\n        " + RIGHT_ARROW + "\n    </g>";
//Strong sand or dust storm
var PLUS_SS = "<g =\"+SS\">\n        <text class=\"wx_text\" x=\"160\" y=\"360\">S</text>\n    </g>";
//Blowing snow
var BLSN = "<g id=\"BLSN\">\n        <text x=\"0\" y=\"350\" class=\"wx_text\" transform=\"rotate(270, 250, 250)\">\u2192</text>\n        <text x=\"50\" y=\"450\" class=\"wx_text\">\u2192</text>\n    </g>";
//Drifting snow
var DRSN = "<g id=\"DRSN\">\n        <text x=\"110\" y=\"350\" class=\"wx_text\" transform=\"rotate(90, 250, 250)\">\u2192</text>\n        <text x=\"110\" y=\"400\" class=\"wx_text\">\u2192</text>\n    </g>\n    ";
//FOG//////////////////////////////////////////////
//Vicinity fog
var VCFG = "<g id=\"VCFG\">\n        <line class=\"wx_graphic\" x1=\"100\" y1=\"150\" x2=\"400\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"100\" y1=\"250\" x2=\"400\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"100\" y1=\"350\" x2=\"400\" y2=\"350\"></line>\n        <path class=\"wx_graphic\" d=\"M 60 135 C 15 165 15 335 65 365\"></path>\n        <path class=\"wx_graphic\" d=\"M 435 135 C 485 150 500 345 435 365\"></path>\n    </g>";
//Patchy fog
var BCFG = "<g id=\"BCFG\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"150\" x2=\"150\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"350\" y1=\"150\" x2=\"450\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"250\" x2=\"450\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"350\" x2=\"150\" y2=\"350\"></line>\n        <line class=\"wx_graphic\" x1=\"350\" y1=\"350\" x2=\"450\" y2=\"350\"></line>\n    </g>";
//Fog, sky discernable
var PRFG = "<g id=\"BCFG\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"150\" x2=\"150\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"350\" y1=\"150\" x2=\"450\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"250\" x2=\"450\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"350\" x2=\"450\" y2=\"350\"></line>\n    </g>";
//Fog, sky undiscernable
var FG = "<g id=\"FG\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"150\" x2=\"450\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"250\" x2=\"450\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"350\" x2=\"450\" y2=\"350\"></line>\n    </g>";
//Freezing fog
var FZFG = "<g id=\"FG\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"150\" x2=\"450\" y2=\"150\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"250\" x2=\"450\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"350\" x2=\"450\" y2=\"350\"></line>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"150\" x2=\"250\" y2=\"350\"></line>\n        <line class=\"wx_graphic\" x1=\"450\" y1=\"150\" x2=\"250\" y2=\"350\"></line>\n    </g>";
//Drizzle
//Light drizzle
var MIN_DZ = "<g id=\"-DZ\">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">,,</text>\n    </g>";
//Moderate drizzle
var DZ = "<g id=\"RA\">\n        <text class=\"wx_text\" x=\"130\" y=\"285\">,,</text>\n        <text class=\"wx_text\" x=\"170\" y=\"175\">,</text>\n    </g>";
//Heavy drizzle
var PLUS_DZ = "<g id=\"RA\">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">,,</text>\n        <text class=\"wx_text\" x=\"170\" y=\"145\">,</text>\n        <text class=\"wx_text\" x=\"170\" y=\"320\">,</text>\n    </g>";
//Light freezing drizzle
var MIN_FZDZ = "<g id=\"-DZ\" " + TRANSFORM + ">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">,</text>\n        " + sine + "\n    </g>";
//Moderate to heavy freezing drizzle
var FZDZ = "<g id=\"-DZ\" " + TRANSFORM + ">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">,,</text>\n        " + sine + "    \n    </g>";
//Light drizzle and rain
var MIN_DZRA = "<g id=\"MIN_DZRA>\n        <text style=\"fill: rgb(51, 51, 51); font-family: Georgia; font-size: 300px; white-space: pre;\" x=\"198.442\" y=\"348.054\" dx=\"0.743\" dy=\"-39.081\">,</text>\n        <text style=\"fill: rgb(51, 51, 51); font-family: &quot;Roboto Slab&quot;; font-size: 100px; white-space: pre;\" x=\"313.598\" y=\"154.93\" dx=\"-105.782\" dy=\"92.343\">\u25CF</text>\n    </g>";
//Moderate to heavy drizzle and rain
var DZRA = "<g id=\"MIN_DZRA>\n        <text x=\"198.442\" y=\"348.054\" style=\"white-space: pre; fill: rgb(51, 51, 51); font-family: &quot;Georgia&quot;; font-size: 300px;\">,</text>\n        <text style=\"fill: rgb(51, 51, 51); font-family: Georgia; font-size: 300px; white-space: pre;\" x=\"200.662\" y=\"301.835\" dx=\"-0.441\" dy=\"-136.772\">,</text>\n        <text style=\"fill: rgb(51, 51, 51); font-family: &quot;Roboto Slab&quot;; font-size: 100px; white-space: pre;\" x=\"313.598\" y=\"154.93\" dx=\"-106.683\" dy=\"133.71\">\u25CF</text>\n    </g>";
//RAIN
//Light rain
var MIN_RA = "<g id=\"-RA\">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">..</text>\n    </g>";
//Moderate rain
var RA = "<g id=\"RA\">\n        <text class=\"wx_text\" x=\"130\" y=\"285\">..</text>\n        <text class=\"wx_text\" x=\"170\" y=\"175\">.</text>\n    </g>";
//Heavy rain
var PLUS_RA = "<g id=\"RA\">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">..</text>\n        <text class=\"wx_text\" x=\"170\" y=\"145\">.</text>\n        <text class=\"wx_text\" x=\"170\" y=\"320\">.</text>\n    </g>";
//Light freezing rain
var MIN_FZRA = "<g id=\"-RA\" transform=\"matrix(1.4,0,0,1.2,-102.2,-30.3)\">\n        <text class=\"wx_text\" x=\"130\" y=\"240\">.</text>\n        " + sine + "\n    </g>";
//Moderate to heavy freezing rain
var FZRA = "<g id=\"-RA\" " + TRANSFORM + ">\n    <text class=\"wx_text\" x=\"130\" y=\"240\">..</text>\n    " + sine + "\n    </g>";
//Light rain and snow
var MIN_RASN = "<g id=\"MIN_RASN\">\n        <text style=\"fill: rgb(51, 51, 51); font-family: Georgia; font-size: 200px; white-space: pre;\" x=\"198.442\" y=\"348.054\" dx=\"-0.648\" dy=\"82.18\">*</text>\n        <text style=\"fill: rgb(51, 51, 51); font-family: &quot;Roboto Slab&quot;; font-size: 200px; white-space: pre;\" x=\"313.598\" y=\"154.93\" dx=\"-129.822\" dy=\"98.015\">\u25CF</text>\n    </g>";
//Moderate to heavy rain and snow
var RASN = "<g id=\"RASN\">\n        <text style=\"fill: rgb(51, 51, 51); font-family: Georgia; font-size: 200px; white-space: pre;\" x=\"198.442\" y=\"348.054\" dx=\"6.111\" dy=\"137.208\">*</text>\n        <text style=\"fill: rgb(51, 51, 51); font-family: &quot;Roboto Slab&quot;; font-size: 200px; white-space: pre;\" x=\"313.598\" y=\"154.93\" dx=\"-124.964\" dy=\"158.382\">\u25CF</text>\n        <text transform=\"matrix(1, 0, 0, 1, 11.82478, 80.656288)\" style=\"fill: rgb(51, 51, 51); font-family: Georgia; font-size: 200px; white-space: pre;\" x=\"198.442\" y=\"348.054\" dx=\"-10.654\" dy=\"-182.434\">*</text>\n    </g>";
//SNOW and MISC FROZEN PERCIP
//Light snow
var MIN_SN = "<g id=\"-SN\">\n        <text class=\"snow\" x=\"50\" y=\"370\">**</text>\n    </g>\n    ";
//Moderate snow
var SN = "<g id=\"SN\">\n        <text class=\"snow\" x=\"50\" y=\"460\">**</text>\n        <text class=\"snow\" x=\"120\" y=\"325\">*</text>\n    </g>";
//Heavy snow
var PLUS_SN = "<g id=\"+SN\">\n        <text class=\"snow\" x=\"50\" y=\"420\">**</text>\n        <text class=\"snow\" x=\"120\" y=\"285\">*</text>\n        <text class=\"snow\" x=\"120\" y=\"540\">*</text>\n    </g>";
//Snow grains
var SG = "<g id=\"SG\">\n        <polygon class=\"wx_graphic\" points=\"250 150 150 300 350 300\"></polygon>\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"230\" x2=\"197\" y2=\"230\"></line>\n        <line class=\"wx_graphic\" x1=\"303\" y1=\"230\" x2=\"450\" y2=\"230\"></line>\n    </g>";
//Ice crystals
var IC = "<g id=\"IC\">\n        <line class=\"wx_graphic\" x1=\"50\" y1=\"250\" x2=\"450\" y2=\"250\"></line>\n        <line class=\"wx_graphic\" x1=\"175\" y1=\"175\" x2=\"325\" y2=\"325\"></line>\n        <line class=\"wx_graphic\" x1=\"325\" y1=\"175\" x2=\"174\" y2=\"325\"></line>  \n    </g>";
//Ice pellets
var PE_PL = "<g id=\"PE_PL\">\n      <polygon class=\"wx_graphic\" points=\"250 150 150 300 350 300\"></polygon>\n      <text style=\"fill: black; font-size: 100px;\" x=\"237.271\" y=\"242.526\" dx=\"-18.412\" dy=\"32.137\">\u25CF</text>\n    </g>";
//SHOWERY PERCIPITATION
//Light rain showers
var MIN_SHRA = "<g id=\"MIN_SHRA\">\n        <polygon class=\"wx_graphic\"  points=\"150 160 350 160 250 475\"></polygon>\n        <text x=\"190\" y=\"140\" style=\"font-size: 200px;\">\u25CF</text>\n    </g>";
//Moderate to heavy rain showers
var SHRA = "";
//Light rain and snow showers
var MIN_SHRASN = "";
//Moderate to heavy rain and snow showers
var SHRASN = "";
//Light snow showers
var MIN_SHSN = "";
//Moderate to heavy snow showers
var SHSN = "";
//Light showers with hail, not with thunder
var MIN_GR = "";
//Moderate to heavy showers with hail, not with thunder
var GR = "";
// THUNDERSTORMS
//Light to moderate thunderstorm with rain
var TSRA = "";
//Light to moderate thunderstorm with hail
var TSGR = "";
//Thunderstorm with heavy rain
var PLUS_TSRA = "";

/**
 * Map of weather abbriviation to SVG data and Full text
 */
function buildWeatherJsonObject() {
    let wxJson = {
        "FU": { svg: FU_VA, text: "Smoke" },
        "VA": { svg: FU_VA, text: "Volcanic Ash" },
        "HZ": { svg: HZ, text: "Haze" },
        "DU": { svg: DU_SA, text: "Dust" },
        "SA": { svg: DU_SA, text: "Sand" },
        "BLDU": { svg: BLDU_BLSA, text: "Blowing Dust" },
        "BLDA": { svg: BLDU_BLSA, text: "Blowing Sand" },
        "PO": { svg: PO, text: "Dust Devil" },
        "VCSS": { svg: VCSS, text: "Vicinity Sand Storm" },
        "BR": { svg: BR, text: "Mist or light fog" },
        "MIFG": { svg: MIFG, text: "Continuous Shallow Fog" },
        "VCTS": { svg: VCTS, text: "Vicinity Thunderstorm" },
        "VIRGA": { svg: VIRGA, text: "Virga" },
        "VCSH": { svg: VCSH, text: "Vicinity showers" },
        "TS": { svg: TS, text: "Thunderstorm" },
        "SQ": { svg: SQ, text: "Squall" },
        "FC": { svg: FC, text: "Funnel Cloud/Tornado" },
        "SS": { svg: SS, text: "Sand/Dust Storm" },
        "+SS": { svg: PLUS_SS, text: "Strong Sand/Dust Storm" },
        "BLSN": { svg: BLSN, text: "Blowing Snow" },
        "DRSN": { svg: DRSN, text: "Drifting Snow" },
        "VCFG": { svg: VCFG, text: "Vicinity Fog" },
        "BCFG": { svg: BCFG, text: "Patchy Fog" },
        "PRFG": { svg: PRFG, text: "Fog, Sky Discernable" },
        "FG": { svg: FG, text: "Fog, Sky Undiscernable" },
        "FZFG": { svg: FZFG, text: "Freezing Fog" },
        "-DZ": { svg: MIN_DZ, text: "Light Drizzle" },
        "DZ": { svg: DZ, text: "Moderate Drizzle" },
        "+DZ": { svg: PLUS_DZ, text: "Heavy Drizzle" },
        "-FZDZ": { svg: MIN_FZDZ, text: "Light Freezing Drizzle" },
        "FZDZ": { svg: FZDZ, text: "Moderate Freezing Drizzle" },
        "+FZDZ": { svg: FZDZ, text: "Heavy Freezing Drizzle" },
        "-DZRA": { svg: MIN_DZRA, text: "Light Drizzle & Rain" },
        "DZRA": { svg: DZRA, text: "Moderate to Heavy Drizzle & Rain" },
        "-RA": { svg: MIN_RA, text: "Light Rain" },
        "RA": { svg: RA, text: "Moderate Rain" },
        "+RA": { svg: PLUS_RA, text: "Heavy Rain" },
        "-FZRA": { svg: MIN_FZRA, text: "Light Freezing Rain" },
        "FZRA": { svg: FZRA, text: "Moderate Freezing Rain" },
        "+FZRA": { svg: FZRA, text: "Heavy Freezing Rain" },
        "-RASN": { svg: MIN_RASN, text: "Light Rain & Snow" },
        "RASN": { svg: RASN, text: "Moderate Rain & Snow" },
        "+RASN": { svg: RASN, text: "Heavy Rain & Snow" },
        "-SN": { svg: MIN_SN, text: "Light Snow" },
        "SN": { svg: SN, text: "Moderate Snow" },
        "+SN": { svg: PLUS_SN, text: "Heavy Snow" },
        "SG": { svg: SG, text: "Snow Grains" },
        "IC": { svg: IC, text: "Ice Crystals" },
        "PE": { svg: PE_PL, text: "Ice Pellets" },
        "PL": { svg: PE_PL, text: "Ice Pellets" }
    };
    return wxJson;
}


/**
 * Generate a wind barb SVG image
 * @param {int} width 
 * @param {int} height 
 * @param {object} WeatherItem 
 * @returns 
 */
function getWindBarbSvg(width, height, wxitem) {
    let catcolor = "";
    let svg = "";
    let thisWind = {
        wind_direction: wxitem.wind.direction,
        wind_speed: wxitem.wind.speed,
        gust_speed: wxitem.wind.gustspeed,
        station: wxitem.station_id
    };
    try {
        catcolor = wxitem.color;
        svg = `<svg xmlns="http://www.w3.org/2000/svg" ` +
                  `width="${width}" height="${height}" ` + 
                  `viewBox="0 0 500 500">` + 
                  (0, genWind)(thisWind) + 
                  `<g id="clr">` + 
                       `<circle cx="250" cy="250" r="30" stroke="#000000" stroke-width="3" fill="${catcolor}"/>` +
                  `</g>` + 
               `</svg>`;
    }
    catch {}
    return svg; 
}
/**
 * Convert ºF to ºF
 * @param celsius
 */
function cToF(celsius) {
    if (celsius != null) {
        return Math.round(celsius * 9 / 5 + 32);
    }
}

var GUST_WIDTH = 5;
var WS_WIDTH = 5;
/**
 * Creates a windbarb for the metar
 * @param windItem
 * @returnsif (!ownshipLayer) {
        ownshipLayer = new VectorLayer({
            source: new VectorSource(),
        });
        map.addLayer(ownshipLayer);
    }

    ownshipLayer.getSource().addFeature(pointFeature);
 */
function genWind(windItem) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var WDD = windItem.wind_direction ? windItem.wind_direction : 0;
    var WSP = windItem.wind_speed ? windItem.wind_speed : 0;
    var WGSP = windItem.gust_speed ? windItem.gust_speed : 0;
    var wind = "";
    var gust = "";
    if (WSP === 0) {
        wind =
            `<g id="calm"><ellipse id="calm-marker" stroke="#000" fill="#00000000" cx="250" cy="250" rx="35" ry="35"/></g>`;
    }
    else {
        gust = (windItem.gust_speed === null || windItem.gust_speed === undefined) ? "" :
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
        //barb = `<line id="${tag}-barb-1-long" stroke-width="${width}" y1="50" x1="250" y2="50" x2="300" stroke="${fill}" transform="rotate(-35, 250, 50)"/>`;
        barb = `<line id="${tag}-barb-1-long" stroke-width="${width}" y1="90" x1="250" y2="90" x2="305" stroke="${fill}" transform="rotate(-35, 250, 90)"/>`;
    }
    else if (speed >= 50) {
        barb = `<polygon id="${tag}-barb-1-flag" points="248,98 290,68 248,68" fill="${fill}" />`;
    }
    return barb;
}
/**
 * Generate second barb
 * @param speed wind or gust speed
 * @param gust set to true for gust
 * @returns
 */
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
/**
 * Generate third barb
 * @param speed wind or gust speedparseWea
 * @param gust set to true for gust
 * @returns
 */
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
/**
 * Generate forth barb
 * @param speed wind or gust speed
 * @param gust set to true for gust
 * @returnss
 */
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
/**
 * Generate fifth barb
 * @param speed wind or gust speed
 * @param gust set to true for gust
 * @returns
 */
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

/**
 * Parse international temp dewp point format.
 * @param rawWxItem raw metardisplayMetar
 * @returns
 */
function parseTempInternational(rawWxItem) {
    var re = /\s(M)?(\d{2})\/(M)?(\d{2})\s/g;
    var matches = re.exec(rawWxItem);
    if (matches != null) {
        var temp = parseInt(matches[2]) * (matches[1] == null ? 1 : -1);
        var dew_point = parseInt(matches[4]) * (matches[3] == null ? 1 : -1);
        return [temp, dew_point];
    }
}

/**
 * Parse North American temp dew point format
 * @param rawWxItem raw metar
 * @returns
 */
function parseTempNorthAmerica(rawWxItem) {
    var re = /(T)(\d{1})(\d{2})(\d{1})(\d{1})(\d{2})(\d{1})/g;
    var matches = re.exec(rawWxItem);
    if (matches != null) {
        var temp = parseFloat(matches[3] + "." + matches[4]) * (matches[2] === "0" ? 1 : -1);
        var dew_point = parseFloat(matches[6] + "." + matches[7]) * (matches[5] === "0" ? 1 : -1);
        return [temp, dew_point];
    }
}

/**
 * Utility function to trim and round Metar or TAF  
 * altimeter value to a standard fixed(2) number
 * @param {*} altimeter 
 * @returns 
 */
function getAltimeterSetting(altimeter) {
    let dbl = parseFloat(altimeter);
    return dbl.toFixed(2).toString();
}

/**
 * Convert statute miles to desired unit 
 * @param {*} miles: statute miles
 * @returns statute miles, kilometers or nautical miles   
 */
 function getDistanceUnits(miles) {
    let num = parseFloat(miles);
    let label = "mi";
    switch (distanceunit) {
        case DistanceUnits.kilometers: 
            num = miles * 1.609344;
            label = "km"
            break;
        case DistanceUnits.nauticalmiles:
            num = miles * 0.8689762419;
            label = "nm";
            break;
    }
    return `${num.toFixed(1)} ${label}`;
}

/**
 * Get inches of mercury fixed at 2 decimal places
 * @param {float} altimeter 
 * @returns 
 */
function getInchesOfMercury(altimeter) {
    let inhg = parseFloat(altimeter);
    return inhg.toFixed(2);
}

/**
 * Get the image that corresponds to icing or turbulence condition
 * @param {string} conditiontype 
 * @param {string} conditionvalue 
 * @returns html image string
 */
function getConditionImage(conditiontype, conditionvalue) {
    let image = "";
    if (conditiontype === "icing_intensity") {
        switch (conditionvalue) {
            case "NEGclr":
            case "NEG":
                image = "/images/Nil.png";
                break;
            case "RIME":
            case "TRC":
                image = "/images/IceTrace.png";
                break;
            case "TRC-LGT":
                image = "/images/IceTraceLight.png"
            case "LGT":
                image = "/images/IceLight.png";
                break;
            case "LGT-MOD":
                image = "/images/IceLightMod.png";
                break;
            case "MOD":
                image = "/images/IceMod.png";
                break;
            case "MOD-SEV":
                image = "/images/IceLight.png";
                break;
            case "SEV":
                image = "/images/IceSevere.png";
                break;
        }
    }   
    else if (conditiontype === "turbulence_intensity") { 
        switch (conditionvalue) {
            case "NEG":
            case "NEGclr": 
                image = "/images/Nil.png";
                break;
            case "SMTH-LGT":
            case "LGT":
                image = "/images/TurbSmoothLight.png";
            case "LGT-CHOP":
                image = "/images/TurbLight.png";    
                break;
            case "CHOP":
            case "LGT-MOD":
                image = "/images/TurbLightMod.png";
                break;
            case "MOD":
            case "MOD-CHOP":
                image = "/images/TurbMod.png";
                break;
            case "MOD-SEV":
                image = "/images/TurbModSevere.png";
                break;
            case "SEV":
                image = "/images/TurbSevere.png";
                break;
        }
    }
    else {
        image = "";
    }
    
    return image;
}

/**
 * Get the formatted name of an airport
 * @param {string} ident, the airport identifier 
 * @returns string, formatted name of the airport
 */
 function getFormattedAirportName(ident) {
    let retvalue = airportNameKeymap.get(ident);
    if (retvalue === undefined || 
        retvalue === "undefined" ||
        retvalue === "") {
        retvalue = "";
    } 
    else {
        retvalue = retvalue.replace("/", "\n");
        retvalue = retvalue.replace(",", "\n");
    }
    return retvalue;
}

/**
 * Get the local machine dae/time from the supplied ZULU date
 * @param {*} zuludate: the ZULU date to be translated 
 * @returns string: the translated date in standard or daylight time
 */
 function getLocalTime(zuludate) {
    let date = new Date(zuludate);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let year = date.getFullYear();
    let tzone = "";

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;

    let timex = date.toString().split("GMT");
    let time = timex[1];

    if (time.search("Eastern Standard") > -1) {
        tzone = "(EST)"; 
    }
    if (time.search("Eastern Daylignt") > -1) {
        tzone = "(EDT)"; 
    }
    if (time.search("Central Standard") > -1) {
        tzone = "(CST)"; 
    }
    if (time.search("Central Daylight") > -1) {
        tzone = "(CDT)"; 
    }
    if (time.search("Mountain Standard") > -1) {
        tzone = "(MST)"; 
    }
    if (time.search("Mountain Daylight") > -1) {
        tzone = "(MDT)"; 
    }
    if (time.search("Pacific Standard") > -1) {
        tzone = "(PST)"; 
    }
    if (time.search("Pacific Daylight") > -1) {
        tzone = "(PDT)"; 
    }
    if (time.search("Alaska Standard") > -1) {
        tzone = "(AKST)"; 
    }
    if (time.search("Alaska Daylight") > -1) {
        tzone = "(AKDT)"; 
    }
    if (time.search("Atlantic Standard") > -1) {
        tzone = "(AST)"; 
    }
    if (time.search("Atlantic Daylight") > -1) {
        tzone = "(ADT)";
    }
    return `${month}-${day}-${year} ${hours}:${minutes} ${ampm} ${tzone}`;
}

/**
 * Set ownship orientation from Stratux situation, updates airplane image current position
 */
 function setOwnshipOrientation(jsondata) {
    /*---------------------------------------------------------------
     * Situation json data field example
     *---------------------------------------------------------------
      { "GPSLastFixSinceMidnightUTC": 61233.1,GPSLatitude": 30.714376,"GPSLongitude": -98.254944,"GPSFixQuality": 1,"GPSHeightAboveEllipsoid": 1187.6641,
        "GPSGeoidSep": -78.41207,"GPSSatellites": 9,"GPSSatellitesTracked": 22,"GPSSatellitesSeen": 14,"GPSHorizontalAccuracy": 4.8500004,
        "GPSNACp": 10,"GPSAltitudeMSL": 1266.0762,"GPSVerticalAccuracy": 6.85,"GPSVerticalSpeed": 0,"GPSLastFixLocalTime": "0001-01-03T18:43:51.48Z",
        "GPSTrueCourse": 45.51,"GPSTurnRate": 0,"GPSGroundSpeed": 1.1610000133514404,"GPSLastGroundTrackTime": "0001-01-03T18:43:51.48Z",
        "GPSTime": "2022-07-14T17:00:33.18Z","GPSLastGPSTimeStratuxTime": "0001-01-03T18:43:51.48Z","GPSLastValidNMEAMessageTime": "0001-01-03T18:43:51.48Z",
        "GPSLastValidNMEAMessage": "$GNGGA,170033.10,3042.86261,N,09815.29674,W,1,09,0.97,385.9,M,-23.9,M,,*77","GPSPositionSampleRate": 9.998427260812582,
        "BaroTemperature": 41.89,"BaroPressureAltitude": 1085.1527,"BaroVerticalSpeed": -3.136783,"BaroLastMeasurementTime": "0001-01-03T18:43:51.53Z",
        "BaroSourceType": 1,"AHRSPitch": -0.0025035837716802546,"AHRSRoll": 0.049514056369771665,"AHRSGyroHeading": 3276.7,"AHRSMagHeading": 3276.7,
        "AHRSSlipSkid": -0.03840070310305229,"AHRSTurnRate": 3276.7,"AHRSGLoad": 0.9996413993502861,"AHRSGLoadMin": 0.9930797723335983,
        "AHRSGLoadMax": 1.0025976589458154,"AHRSLastAttitudeTime": "0001-01-03T18:43:51.53Z","AHRSStatus": 7
      }
    */
        
    const coords = fromLonLat([jsondata.GPSLongitude, jsondata.GPSLatitude]);
    const pointFeature = new Feature({
        geometry: new Point(coords)
    });

    pointFeature.setStyle(new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'red' }),
            stroke: new Stroke({ color: 'black', width: 1 })
        })
    }));

    // Create a vector source and layer if not already present
    if (!ownshipLayer) {
        ownshipLayer = new VectorLayer({
            source: new VectorSource(),
        });
        map.addLayer(ownshipLayer);
    }

    ownshipLayer.getSource().addFeature(pointFeature);
}

