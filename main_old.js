import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import './style.css';
import { Map as OLMap, View } from 'ol';
import { rawMetarToSVG, rawMetarToMetarPlot } from './svgMetar.js';
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
import { parseWeatherMessage } from './messageparser.js';
import { formatMessageDisplay } from './messagedisplay.js';
import { genCoverage, getWeatherSVG, genWind, metarToSVG, getWindBarbSvg } from './svgMetar.js';
import settings from '/settings.js';
import { parsePirepData } from './pirepParser';
import { parseTafAmdData, parseTafData } from './tafParser';
import BaseLayer from 'ol/layer/Base';
import { WEATHER, CLOUDS, CONDITIONS, WEATHER_ICONS } from './weatherdictionary.js';

//import  from './pirepLayer';

const URL_GET_AIRPORTLIST = `http://localhost:8500/airportlist`;

const urlsituation = "ws://localhost/situation";
const urltraffic = "ws://localhost/traffic";
const urlweather = "ws://localhost:8550";

let airports = {};
let ownshipLayer;
let last_longitude = 0.0;
let last_latitude = 0.0;
let metars = [];
let tafs = [];
let pireps = [];
let traffic = [];

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

/**
 * Returns SVG icon
 * @param key weather abbriviation
 */
function getWeatherLegend(key) {
    var weather = WEATHER[key] != null ? WEATHER[key].svg : "";
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"65\" height=\"65\" viewBox=\"0 0 500 500\">\n                <style>\n                    .wx_text{ \n                        color: black;\n                        font-size: 400px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .snow{ \n                        color: black;\n                        font-size: 300px;\n                        font-family: \"Noto Sans\";\n                        white-space: pre;\n                    }\n                    .wx_graphic {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 30\n                    }\n                    .wx_graphic_thin {\n                        stroke: black;\n                        fill: none;\n                        stroke-width: 15\n                    }\n                </style>\n                " + weather + "\n            </svg>";
}

function getWeatherIconStyle(weatherObject) {
    if (!weatherObject) {
        // Return a default icon style if weatherObject is null or undefined
        return new Style({
            image: new Icon({
                src: '/images/vfr.png',
                scale: 0.3,
                anchor: [0.5, 0.5],
                opacity: 1
            })
        });
    }
    let src = '';
    let fscale = 0.0;
    let fsize = [];
    switch (weatherObject.type) {
        case 'TAF':
        case 'TAF.AMD':
            src = '/images/taf.svg';
            fscale = 0.2;
            fsize = [126, 90];
            break;
        case 'PIREP':
            src = '/images/airplane.svg';
            fscale = 0.5;
            fsize = [85, 85];
            break;
        case 'METAR':
        case 'SPECI':
        default:
            src = '/images/vfr.png'; 
            fscale = 0.3;
            fsize = [55, 55];
            break;
    }
    let icon = new Style({
        image: new Icon({
            src: src,
            size: fsize,
            scale: fscale,
            anchor: [0.5, 0.5],
            opacity: 1
        })
    });
}

// /**
//  * Parse Weather items
//  * @param metar raw metar
//  * @returns
//  */
// function parseWeather(metar) {
//     var obs_keys = Object.keys(WEATHER).join('|').replace(/\+/g, "\\+");
//     var re = new RegExp("\\s?(" + obs_keys + ")\\s", 'g');
//     var matches = metar.match(re);
//     if (matches != null) {
//         return matches.map(function (match) {
//             var key = match.trim();
//             return {
//                 abbreviation: key,
//                 meaning: WEATHER[key].text
//             };
//         });
//     }
//     else {
//         return new Array();
//     }
// }

// function parseFlightCategory(metarObject) {
//     let visMiles = 0;
//     let visibility = metarObject.visibility; 
//     let ceiling = null;
//     let cond = "VFR";

//     visMiles = visibility.distance;

//     if (metarObject.clouds && metarObject.clouds.length > 0) {
//         // Find lowest cloud base (exclude SKC, CLR, NSC, FEW, SCT)
//         const coverRanks = { BKN: 3, OVC: 4, VV: 5 };
//         let lowest = metarObject.clouds
//             .filter(c => coverRanks[c.abbreviation])
//             .map(c => c.altitude)
//             .sort((a, b) => a - b)[0];

//         ceiling = lowest || null;
//     }
    
//     if ((visMiles !== null && visMiles < 1)) cond = "LIFR";
//     if ((visMiles !== null && visMiles < 3)) cond = "IFR";
//     if ((visMiles !== null && visMiles < 5)) cond = "MVFR";
    
//     metarObject.flightCategory = cond;

//     return true;
// }

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
const chicagoCoords = fromLonLat([-87.6298, 41.8781]); // Chicago: lon, lat

const map = new OLMap({
    target: 'map',
    view: new View({
        center: chicagoCoords,        
        zoom: settings.startupzoom,
        enableRotation: false,
        minZoom: 1,
        maxZoom: 22
    }),
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


let viewextent = [-180, -85];
let offset = [-18, -18];
let extent = transformExtent(viewextent, 'EPSG:4326', 'EPSG:3857')

let osmTileLayer = new TileLayer({
    source: new OSM(),
    title: "OSM",
    visible: true,
    type: "base",
    zIndex: 0
});
map.addLayer(osmTileLayer);
osmTileLayer.on('change:visible', function () {
    if (osmTileLayer.getVisible()) {
        metarVectorLayer.setVisible(false);
        tafVectorLayer.setVisible(false);
        airportVectorLayer.setVisible(false);
        trafficVectorLayer.setVisible(false);
    }
});

let pirepVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "Pireps",
    visible: false,
    type: "base"
});
map.addLayer(pirepVectorLayer);
pirepVectorLayer.on('change:visible', function () {
    if (pirepVectorLayer.getVisible()) {
        metarVectorLayer.setVisible(false);
        tafVectorLayer.setVisible(false);
        airportVectorLayer.setVisible(false);
        trafficVectorLayer.setVisible(false);
    }
});

let airportVectorLayer = new VectorLayer({
    source: new VectorSource(), 
    title: "All Airports",
    visible: false,
    zIndex: 11
});
map.addLayer(airportVectorLayer);

let metarVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "Metars",
    visible: false,
    zIndex: 13
});
map.addLayer(metarVectorLayer);

let tafVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "TAFs",
    visible: false,
    zIndex: 13
});
map.addLayer(tafVectorLayer);

let trafficVectorLayer = new VectorLayer({
    source: new VectorSource(),
    title: "Traffic",
    visible: false,
    zIndex: 14
});
map.addLayer(trafficVectorLayer);

async function setupStratuxWebsockets() {
    // let wsTraffic = new WebSocket(urltraffic);
    // wsTraffic.onmessage = function(evt){
    //     let data = JSON.parse(evt.data);
    //     console.log(data);
    // }

    // let wsSituation = new WebSocket(urlsituation);
    // wsSituation.onmessage = function(evt){
    //     let data = JSON.parse(evt.data);
    //     setOwnshipOrientation(data);
    //     //console.log(data);
    // }

    let wsWeather = new WebSocket(urlweather);
    wsWeather.onmessage = async function(evt) {
        let data = JSON.parse(evt.data);
        console.log(data);
        let parsedObject = {};
        try {
            parsedObject = await parseWeatherMessage(data);
        } catch (err) {
            console.error("Error parsing weather message:", err);
            return;
        }
        
        if (!parsedObject || !parsedObject.type) {
            return;
        }

        switch (parsedObject.type) {
            case 'METAR':
            case 'SPECI':
                if (metars.length >= 1650) {
                    metars.splice(0, metars.length - 1649);
                }
                metars.push(parsedObject);
                // Add feature directly to layer
                if (parsedObject.lon && parsedObject.lat) {
                    const feature = new Feature({
                        geometry: new Point(fromLonLat([parsedObject.lon, parsedObject.lat])),
                        type: "METAR",
                        object: parsedObject
                    });
                    feature.setStyle(new Style({
                        image: new Icon({
                            src: parsedObject.mapDotSvgURI,
                            scale: 0.7,
                            anchor: [0.5, 0.5]
                        })
                    }));
                    metarVectorLayer.getSource().addFeature(feature);
                    metarVectorLayer.changed();
                }
                break;
            case 'TAF':
            case 'TAF.AMD':
                if (tafs.length >= 500) {
                    tafs.splice(0, tafs.length - 499);
                }
                tafs.push(parsedObject);
                // Add feature directly to layer
                if (parsedObject.lon && parsedObject.lat) {
                    const feature = new Feature({
                        geometry: new Point(fromLonLat([parsedObject.lon, parsedObject.lat])),
                        type: "TAF",
                        object: parsedObject
                    });
                    const style = getWeatherIconStyle(parsedObject);
                    feature.setStyle(style);                        
                    tafVectorLayer.getSource().addFeature(feature);
                    tafVectorLayer.changed();
                }
                break;
            case 'PIREP':
                if (pireps.length >= 500) {
                    pireps.splice(0, pireps.length - 499);
                }
                pireps.push(parsedObject);
                // Add feature directly to layer
                if (parsedObject.lon && parsedObject.lat) {
                    const feature = new Feature({
                        geometry: new Point(fromLonLat([parsedObject.lon, parsedObject.lat])),
                        type: "PIREP",
                        object: parsedObject
                    });
                    const style = getWeatherIconStyle(parsedObject);
                    feature.setStyle(style);    
                    pirepVectorLayer.getSource().addFeature(feature);
                    pirepVectorLayer.changed();
                }
                break;
            default:
                // Ignore other types
                break;
        }
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
        image: new Icon({
            src: '/images/airplane.svg',
            scale: 0.5,
            anchor: [0.5, 0.5],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction'
        })
    }));

    // Create a vector source and layer if not already present
    if (!ownshipLayer) {
        ownshipLayer = new VectorLayer({
            source: new VectorSource(),
            title: 'Own Ship Position'
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
    let coordinate = evt.coordinate;
    map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        if (feature) {
            hasfeature = true;
            let featureObject = feature.get('object');
            if (featureObject.type === "METAR") {
                displayMetarPopup(featureObject);
            } else if (featureObject.type === "TAF") {
                displayTafPopup(featureObject);
            } else if (featureObject.type === "TAF.AMD") {
                displayTafPopup(featureObject);
            } else if (featureObject.type === "PIREP") {
                displayPirepPopup(featureObject)
            } else if (featureObject.type === "AIRPORT") {
                //displayAirportPopup(featureObject);
            } else if (feature.get("traffic")) {
                //displayAirportPopup(featureObject);
            }
            popupoverlay.setPosition(coordinate);
        }
        return true;
    });

    if (!hasfeature) {
        closePopup();
    }
    return false;
});

/**
 * Create the html for a METAR popup element
 * @param {object} metarObject: the metar feature object the user clicked on 
 */
function displayMetarPopup(metarObject) {
    const rawmetar = metarObject.raw_data;
    const ident = metarObject.station;
    let cat = metarObject.flightCategory || "VFR";
    let time = metarObject.observation_time;
    const temp = metarObject.temperature;
    //const dewpC = tempC; //weatherObject.dewpoint_c;
    //const temp = weatherObject.temperature;
    const windir = metarObject.wind?.direction;
    const winspd = metarObject.wind?.speed;
    const wingst = metarObject.wind?.gust; 
    const altim = metarObject.altimeter;
    const vis = metarObject.visibility.distance ? `${metarObject.visibility.distance} ${metarObject.visibility.unit}` : null;
    //const wxcode = weatherObject.wx ? decodeWxDescriptions(weatherObject) : "";
    const taflabelcssClass = "taflabel";
    let skyconditions = "";
    let icingconditions = "";
    if (metarObject.clouds) {
        skyconditions = decodeSkyCondition(metarObject, taflabelcssClass);
    }
    if (metarObject.icing_condition) {
        icingconditions = decodeIcingOrTurbulenceCondition(metarObject, taflabelcssClass);
    }
    
    let label = `<label class="#class">`;
    let css;
    switch(cat) {
        case "IFR":
            css = label.replace("#class", "metarifr");
            break;
        case "LIFR":
            css = label.replace("#class", "metarlifr");
            break;
        case "MVFR":
            css = label.replace("#class", "metarmvfr");
            break;
        case "VFR":
            css = label.replace("#class", "metarvfr");
            break;
    }
    if (ident) {
        let name = metarObject.airport.name;
        let html = `<div id="#featurepopup"><pre><code><p>`;
        html +=    `${css}${name}\n${ident} - ${cat}</label><p></p>`;
        html +=   (time ? `Time:&nbsp<b>${time}</b><br/>` : "");
        html +=   (temp ? `Temp:&nbsp<b>${temp} °C</b> (${temp})<br/>` : "");
        //html +=   (dewp ? `Dewpoint:&nbsp<b>${dewpC} °C</b> (${dewp})<br/>` : "");
        if (typeof windir === "number") {
            html += `Wind Direction:&nbsp;<b>${windir}°</b><br/>`;
        } else if (windir) {
            html += `Wind Direction:&nbsp;<b>${windir}°</b><br/>`;
        }
        html += (winspd ? `Wind Speed:&nbsp<b>${winspd}&nbspkt</b><br/>` : "");
        html += (wingst ? `Wind Gust:&nbsp<b>${wingst}&nbspkt</b><br/>` : "");
        html +=  (altim ? `Altimeter:&nbsp<b>${altim}&nbsphg</b><br/>` : "");
        html +=    (vis ? `Horizontal Visibility:&nbsp<b>${vis}</b><br/>` : "");
        //html += (wxcode ? `Weather:&nbsp<b>${wxcode}</b><br/>`: "");
        html += (skyconditions ? `${skyconditions}` : "");
        html += (icingconditions ? `${icingconditions}` : "");
        html += `</p></code></pre><div class="windsvg">${metarObject.svg}</div>`;
        html += `<br><br>`
        html += `<textarea class="rawdata">${rawmetar}</textarea><br />`; 
        html += `<p><button class="ol-popup-closer" onclick="closePopup()">close</button></p></div>`;
        popupcontent.innerHTML = html;  
    }
}

/**
 * Create the html for a TAF popup element
 * @param {object} tafObject: the taf feature object the user clicked on
 */
function displayTafPopup(tafObject) {

}

/**
 * Create the html for a PIREP popup element
 * @param {object} pirepObject: the pirep feature object the user clicked on
 */
function displayPirepPopup(pirepObject) {
 
}

/**
 * Decode icing or turbulence condition
 * @param {object} condition json object 
 * @returns html string
 */
function decodeIcingOrTurbulenceCondition(condition) {
    let html = "";
    for (const item in condition) {
        let value = condition[item];
        if (typeof(value) === 'object') {
            html += "<p>";
            for (const subitem in value) {
                let subvalue = value[subitem];
                html += parseConditionField(subitem, subvalue);
            }
            html += "</p><hr>";
        } 
        else {
            html += parseConditionField(item, value);
        }
    }        
    return html;        
}

/**
 * Decode weather codes from TAFs or METARS
 * @param {*} codevalue: this could contain multiple space-delimited codes
 * @returns string with any weather description(s)
 */
function decodeWxDescriptions(weatherObject) {
    if (!weatherObject || !weatherObject.weather) return "";
    let outstr = "";
    let vals = Array.isArray(weatherObject.weather) ? weatherObject.weather : weatherObject.weather.split(" ");
    for (let i = 0; i < vals.length; i++) {
        const desc = weatherAcronymKeymap.get(vals[i]) || vals[i];
        outstr += i === 0 ? desc : ` / ${desc}`;
    }
    return outstr;
}

/**
 * Decode sky conditions
 * @param {object} json object skyconditions 
 * @param {string} css class to use 
 * @returns html string 
 */
function decodeSkyCondition(weatherObject, labelclassCss) {
    let html = "";
    if (!weatherObject || !weatherObject.clouds) return html;
    const skycondition = weatherObject.clouds;
    try {
        for (const x in skycondition) {
            let condition = skycondition[x];
            let fieldname = "";
            let fieldvalue = "";
            if (typeof(condition) !== "string") {
                for (const index in condition) {
                    fieldname = getFieldDescription(index);
                    fieldvalue = condition[index];
                    html += `<label class="${labelclassCss}">${fieldname}: <b>${fieldvalue}</b></label><br />`;
                }
            }
            else {
                fieldname = getFieldDescription(x);
                fieldvalue = getSkyConditionDescription(condition);
                html += `<label class="${labelclassCss}">${fieldname}: <b>${fieldvalue}</b></label><br />`;
            }
        }
    }
    catch (error) {
        console.log(error.message);
    }
    return html;
}

function convertCtoF(weatherObject) {
    if (!weatherObject || typeof weatherObject.temp_c !== 'number') return null;
    // Convert Celsius to Fahrenheit
    return Math.round((weatherObject.temp_c * 9) / 5 + 32) + " °F";
}

/**
 * Utility function to trim and round Metar or TAF  
 * altimeter value to a standard fixed(2) number
 * @param {*} weatherObject 
 * @returns 
 */
function getAltimeterSetting(weatherObject) {
    if (!weatherObject || typeof weatherObject.altimeter !== 'number') return null;
    // Format altimeter inHg to two decimal places
    return weatherObject.altimeter.toFixed(2);
}

/**
 * Convert statute miles to desired unit 
 * @param {*} miles: statute miles
 * @returns statute miles, kilometers or nautical miles   
 */
function getDistanceUnits(weatherObject) {
    if (!weatherObject || typeof weatherObject.visibility !== 'number') return null;
    let miles = weatherObject.visibility;
    let num = parseFloat(miles);
    let label = "mi";
    switch (distanceunit) {
        case DistanceUnits.kilometers: 
            num = miles * 1.609344;
            label = "km";
            break;
        case DistanceUnits.nauticalmiles:
            num = miles * 0.8689762419;
            label = "nm";
            break;
    }
    return `${num.toFixed(1)} ${label}`;
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
    // Remove all child nodes (including SVGs) from the popup content
    while (popupcontent.firstChild) {
        popupcontent.removeChild(popupcontent.firstChild);
    }
    return false;
}

window.closePopup = closePopup;

const size = 25;
const piD = (size / 2) * 3.14 * 2;
// var CLR_SQUARE = "<g id=\"clr\">\n        <rect width=\"" + size + "\" height=\"" + size + "\" x=\"calc(250 - " + size / 2 + ")\" y=\"calc(250 - " + size / 2 + ")\" class=\"coverage\"/>\n    </g>";
// var CLR_CIRCLE = "<g id=\"clr\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    </g>";
// var FEW = "<g id=\"few\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n        <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n        stroke-dasharray=\"0 calc(75 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n        class=\"partial\"/>\n    </g>";
// var SCT = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(25 * " + piD + " / 100) calc(50 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
// var BRK = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(49 * " + piD + " / 100) calc(26 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
// var OVC = "<g id=\"ovc\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" class=\"ovc\"/>\n</g>";

/**
 * Weather Descriptor
 */
var Weather = /** @class */ (function () {
    function Weather() {
    }
    return Weather;
}());

// function getMetarColor(metar) {
//     switch (metar.flightCategory) {
//         case "MVFR": 
//             return "#0000ff";
//         case "IFR":
//             return "#FF0000";  
//         case "LIFR": 
//             return "#ff00ff"; 
//         case "VFR":     
//         default:
//             return "#3ef04dff";
//     }
// }

// function getMetarFillColor(visibility) {
//     // If visibilityMeters is a string like "10 SM", extract the numeric part
//     let visMiles = 0;
//     let color = '#10cf20';

//     if (typeof visibility === 'string') {
//         const match = visibility.match(/^([\d.]+)\s*SM$/i);
//         if (match) {
//             visMiles = parseFloat(match[1]);
//         }
//     } else if (typeof visibility === 'number') {
//         visMiles = visibility;
//     } else {
//         return color; // Default to VFR if missing
//     }

//     if (visMiles < 1) color = '#ff00ff'; // LIFR
//     if (visMiles < 3) color = '#ff0000'; // IFR
//     if (visMiles < 5) color = '#0000ff'; // MVFR
//     return color; // VFR
// }

function getWindBarbSvgWithCoverage(metarRaw) {
    // Simple METAR parser for wind and coverage
    const windMatch = metarRaw.match(/(\d{3})(\d{2})KT/);
    const coverageMatch = metarRaw.match(/\b(CLR|SKC|FEW|SCT|BKN|OVC)\b/);

    // Wind
    const windDir = windMatch ? parseInt(windMatch[1], 10) : 0;
    const windSpd = windMatch ? parseInt(windMatch[2], 10) : 0;

    // Coverage
    const coverage = coverageMatch ? coverageMatch[1] : "CLR";

    // SVG for coded circle (simplified for demonstration)
    let coverageSvg = "";
    switch (coverage) {
        case "CLR":
        case "SKC":
            coverageSvg = `<circle cx="250" cy="400" r="30" fill="white" stroke="black" stroke-width="3"/>`;
            break;
        case "FEW":
            coverageSvg = `<path d="M250,400 m-30,0 a30,30 0 0,1 60,0 z" fill="black" stroke="black" stroke-width="3"/>
                           <circle cx="250" cy="400" r="30" fill="white" stroke="black" stroke-width="3"/>`;
            break;
        case "SCT":
            coverageSvg = `<path d="M250,400 m-30,0 a30,30 0 0,1 60,0 l-30,0 z" fill="black" stroke="black" stroke-width="3"/>
                           <circle cx="250" cy="400" r="30" fill="white" stroke="black" stroke-width="3"/>`;
            break;
        case "BKN":
            coverageSvg = `<path d="M250,400 m-30,0 a30,30 0 1,1 60,0 z" fill="black" stroke="black" stroke-width="3"/>
                           <circle cx="250" cy="400" r="30" fill="white" stroke="black" stroke-width="3"/>`;
            break;
        case "OVC":
            coverageSvg = `<circle cx="250" cy="400" r="30" fill="black" stroke="black" stroke-width="3"/>`;
            break;
        default:
            coverageSvg = `<circle cx="250" cy="400" r="30" fill="white" stroke="black" stroke-width="3"/>`;
    }
    
    // Combine SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="450" viewBox="0 0 500 500">
        ${windBarb}
        ${coverageSvg}
    </svg>`;
}

/**
 * Update your buildWeatherJsonObject function to use WEATHER_ICONS:
 */
function buildWeatherJsonObject() {
    let wxJson = {
        "FU": { svg: WEATHER_ICONS.FU_VA, text: "Smoke" },
        "VA": { svg: WEATHER_ICONS.FU_VA, text: "Volcanic Ash" },
        "HZ": { svg: WEATHER_ICONS.HZ, text: "Haze" },
        "DU": { svg: WEATHER_ICONS.DU_SA, text: "Dust" },
        "SA": { svg: WEATHER_ICONS.DU_SA, text: "Sand" },
        "BLDU": { svg: WEATHER_ICONS.BLDU_BLSA, text: "Blowing Dust" },
        "BLDA": { svg: WEATHER_ICONS.BLDU_BLSA, text: "Blowing Sand" },
        "PO": { svg: WEATHER_ICONS.PO, text: "Dust Devil" },
        "VCSS": { svg: WEATHER_ICONS.VCSS, text: "Vicinity Sand Storm" },
        "BR": { svg: WEATHER_ICONS.BR, text: "Mist or light fog" },
        "MIFG": { svg: WEATHER_ICONS.MIFG, text: "Continuous Shallow Fog" },
        "VCTS": { svg: WEATHER_ICONS.VCTS, text: "Vicinity Thunderstorm" },
        "VIRGA": { svg: WEATHER_ICONS.VIRGA, text: "Virga" },
        "VCSH": { svg: WEATHER_ICONS.VCSS, text: "Vicinity showers" },
        "TS": { svg: WEATHER_ICONS.TS, text: "Thunderstorm" },
        "SQ": { svg: WEATHER_ICONS.SQ, text: "Squall" },
        "FC": { svg: WEATHER_ICONS.FC, text: "Funnel Cloud/Tornado" },
        "SS": { svg: WEATHER_ICONS.SS, text: "Sand/Dust Storm" },
        "+SS": { svg: WEATHER_ICONS.PLUS_SS, text: "Strong Sand/Dust Storm" },
        "BLSN": { svg: WEATHER_ICONS.BLSN, text: "Blowing Snow" },
        "DRSN": { svg: WEATHER_ICONS.DRSN, text: "Drifting Snow" },
        "VCFG": { svg: WEATHER_ICONS.VCFG, text: "Vicinity Fog" },
        "BCFG": { svg: WEATHER_ICONS.BCFG, text: "Patchy Fog" },
        "PRFG": { svg: WEATHER_ICONS.BCFG, text: "Fog, Sky Discernable" },
        "FG": { svg: WEATHER_ICONS.FG, text: "Fog, Sky Undiscernable" },
        "FZFG": { svg: WEATHER_ICONS.FG, text: "Freezing Fog" },
        "-DZ": { svg: WEATHER_ICONS.MIN_DZ, text: "Light Drizzle" },
        "DZ": { svg: WEATHER_ICONS.DZ, text: "Moderate Drizzle" },
        "+DZ": { svg: WEATHER_ICONS.PLUS_DZ, text: "Heavy Drizzle" },
        "-FZDZ": { svg: WEATHER_ICONS.MIN_FZDZ, text: "Light Freezing Drizzle" },
        "FZDZ": { svg: WEATHER_ICONS.FZDZ, text: "Moderate Freezing Drizzle" },
        "+FZDZ": { svg: WEATHER_ICONS.FZDZ, text: "Heavy Freezing Drizzle" },
        "-DZRA": { svg: WEATHER_ICONS.MIN_DZRA, text: "Light Drizzle & Rain" },
        "DZRA": { svg: WEATHER_ICONS.DZRA, text: "Moderate to Heavy Drizzle & Rain" },
        "-RA": { svg: WEATHER_ICONS.MIN_RA, text: "Light Rain" },
        "RA": { svg: WEATHER_ICONS.RA, text: "Moderate Rain" },
        "+RA": { svg: WEATHER_ICONS.PLUS_RA, text: "Heavy Rain" },
        "-FZRA": { svg: WEATHER_ICONS.MIN_FZRA, text: "Light Freezing Rain" },
        "FZRA": { svg: WEATHER_ICONS.FZRA, text: "Moderate Freezing Rain" },
        "+FZRA": { svg: WEATHER_ICONS.FZRA, text: "Heavy Freezing Rain" },
        "-RASN": { svg: WEATHER_ICONS.MIN_RASN, text: "Light Rain & Snow" },
        "RASN": { svg: WEATHER_ICONS.RASN, text: "Moderate Rain & Snow" },
        "+RASN": { svg: WEATHER_ICONS.RASN, text: "Heavy Rain & Snow" },
        "-SN": { svg: WEATHER_ICONS.MIN_SN, text: "Light Snow" },
        "SN": { svg: WEATHER_ICONS.SN, text: "Moderate Snow" },
        "+SN": { svg: WEATHER_ICONS.PLUS_SN, text: "Heavy Snow" },
        "SG": { svg: WEATHER_ICONS.SG, text: "Snow Grains" },
        "IC": { svg: WEATHER_ICONS.IC, text: "Ice Crystals" },
        PE: { svg: WEATHER_ICONS.PE_PL, text: "Ice Pellets" },
        PL: { svg: WEATHER_ICONS.PE_PL, text: "Ice Pellets" }
    };
    return wxJson;
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

