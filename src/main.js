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

const URL_GET_AIRPORTLIST = `http://localhost:8500/airportlist`;

const urlsituation = "ws://127.0.0.1/situation";
const urltraffic = "ws://127.0.0.1/traffic";
const urlweather = "ws://127.0.0.1/weather";

let airports = {};
let settings = {};
let WEATHER = buildWeatherJsonObject();
let RECENT_WEATHER = buildRecentWeatherJsonObject();
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

/**
 * Map objects used for various keyname lookups
 */
let airportNameKeymap = new Map();
let tafFieldKeymap = new Map();
let metarFieldKeymap = new Map();
let weatherAcronymKeymap = new Map();
let icingCodeKeymap = new Map();
let turbulenceCodeKeymap = new Map();
let skyConditionKeymap = new Map();
let trafficMap = new Map();
/*******keymap loading ******/
loadTafFieldKeymap();
loadMetarFieldKeymap();
loadWeatherAcronymKeymap();
loadTurbulenceCodeKeymap();
loadIcingCodeKeymap();
loadSkyConditionmKeymap();


/**
 * Classes used by the on-the-fly weather SVG in metar popups
 */
class WeatherItem {
    /**
     * Extracted Metar data in a human readable format.
     * @param metarString raw metar string if provided station and time will be ignored and replaced with the content in the raw METAR
     * @param station staion name for instance creation
     * @param time time for instance creation
     */
    constructor (wxtype, rawWxItem, station, time) {
        this.type = wxtype;
        this.parsedwx = parseStandardMetar(rawWxItem);
        this.station = station !== null && station !== void 0 ? station : "----";
        this.airport = findAirportByICAO(station);
        this.time = parseDate(rawWxItem);
        this.observation_time = this.time;
        this.visibility = parseVisibility(rawWxItem);
        this.longitude = 0.0;
        this.latitude = 0.0;
        this.color = "white";
        this.rawWxItem = rawWxItem;
        this.auto = parseAuto(rawWxItem);
        this.altimeter = parseAltimeter(rawWxItem);
        this.cavoc = parseCavok(rawWxItem);
        this.temp_c = 15;
        this.dewpoint_c = 0;
        this.temp_f = 57;
        this.dewpoint_f = 32;
        let temps_int = parseTempInternational(rawWxItem);
        if (temps_int != null) {
            this.temp_c = temps_int[0];
            this.dewpoint_c = temps_int[1];
        }
        let temps_ne = parseTempNorthAmerica(rawWxItem);
        if (temps_ne != null) {
            this.temp_f = temps_ne[0];
            this.dewpoint_f = temps_ne[1];
        }
        this.forecast = []; //parseForecast(rawWxItem);
        this.clouds = parseClouds(rawWxItem);
        //this.weather = parseWeather(rawWxItem);
        this.wind = parseWind(rawWxItem);
        this.sky_condition = [];
        this.icing_condition = [];
        this.flightCategory = []; 
        this.msgjson = {};

        if (this.airport !== null && this.airport !== undefined) {
            this.station = this.airport.ident;
            this.longitude =  this.airport.lon;
            this.latitude = this.airport.lat;
        }
    }
    
    parseFlightCategory() {
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
 * 
 * @param {*} temp: Temperature in Centigrade 
 * @returns Farenheit temperature fixed to 2 decimal places
 */
const convertCtoF = ((temp) => {
    if (temp == undefined) return "";
    let num = (temp * 9/5 + 32);
    if (num === NaN || num === undefined) return "";
    else return `${num.toFixed(1)} F°`;
});

await getAppSettingsAsync();
await getAirportListAsync();


/**
 * Get the application settings from the server
 */
async function getAppSettingsAsync() {
    try {
        const response = await fetch('/getsettings');
        if (!response.ok) {
            throw new Error('Error fetching data: ' + response.status);
        }
        settings = await response.json();
        return settings;
    } catch (error) {
        throw new Error(error.message || 'Network error');
    }
}

/**
 * Get the list of airports from the server
 */
async function getAirportListAsync() {
    try {
        const response = await fetch('/airportlist');
        if (!response.ok) {
            throw new Error('Error fetching data: ' + response.status);
        }
        const jsonobj = await response.json();
        airports = jsonobj.airports;
        return airports;
    } catch (error) {
        throw new Error(error.message || 'Network error');
    }
}

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
/*--------------------------------------*/
let heliportMarker = new Icon({
    crossOrigin: 'anonymous',
    src: '/images/helipad.png',
    size: [55, 55],
    offset: [0, 0],
    opacity: 1,
    scale: .50
});

const airportStyle = new Style({
    image: airportMarker
});

const heliportStyle = new Style({
    image: heliportMarker
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
        processStratuxWeather(data);
    }
}

/**
 * Region dropdown select event
 */
regionselect.addEventListener('change', (event) => {
    lastcriteria = event.target.value;
    selectFeaturesByCriteria();
});

function findAirportByICAO(icao) {
    let response = {};
    response = airports.find(airport => airport.ident === icao);
    return response;     
}

/**
 * Load airports into their feature collection 
 * @param {jsonobj} airport JSON object 
 */
await processAirports();
async function processAirports() {
    // setup the stratux websockets
    await setupStratuxWebsockets();

    let usastates = new Map();
    let isoregions = new Map();
    try {
        for (let i=0; i< airports.length; i++) {
            let airport = airports[i];
            let lon = airport.lon;
            let lat = airport.lat;
            let isoregion = airport.isoregion;
            let country = airport.country;
            if (isoregion.search("US-") > -1) { 
                usastates.set(country, country);
            }
            else {
                isoregions.set(country, country);
            }
            let airportFeature = new Feature({
                ident: airport.ident,
                type: airport.type,
                datatype: "airport",
                isoregion: isoregion,
                country: country,
                geometry: new Point(fromLonLat([lon, lat]))
            });
            airportFeature.setId(airport.ident);
            if (airport.type === "heliport") {
                airportFeature.setStyle(heliportStyle);
            }
            else {
                airportFeature.setStyle(airportStyle);
            }
            let featureSource = airportVectorLayer.getSource();
            let features = featureSource.getFeatures();
            features.push(airportFeature);
            airportNameKeymap.set(airport.ident, airport.name);
            airportFeature.changed();
        }

        /**
         * This is for the region select dropdown list
         * Map sort all region airports in alpha order by US state 
         * we want US states to be at the top of the list followed
         * by the rest of the isoregions 
         */
        usastates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => a[1] - b[1]);
        }
        usastates.forEach((country, isoregion) => {
            let option = document.createElement("option");
            option.value = isoregion;
            option.text = country;
            regionselect.appendChild(option);
        });
        
        regionmap[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => a[1] - b[1]);
        }
        isoregions.forEach((country, isoregion) => { 
            let option = document.createElement("option");
            option.value = isoregion;
            option.text = country;
            regionselect.appendChild(option);
        });
    }
    catch(err){
        console.error(err);
    } 
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
 * Place metar features on the map. color-coded to the conditions
 * @param {object} wxdata: JSON object represents a specific wx type
 */
function processStratuxWeather(wxdata) {
    if (wxdata.Location.length == 3) wxdata.Location = "K" + wxdata.Location;
    let newdata = `${wxdata.Location} ${wxdata.Data}`;
    let wxitem = new WeatherItem(wxdata.Type, newdata, wxdata.Location, wxdata.LocaltimeReceived); 
    let jsonobj = { raw_text: newdata, station: wxdata.Location, observation_time: wxdata.LocaltimeReceived };
    wxitem.msgjson = jsonobj;

    switch (wxitem.type) {
        case "METAR":
            console.log("METAR:", wxitem);    
            processStratuxMetar(wxitem);
            break;
        case "SPECI":
            console.log("SPECI:", wxitem);    
            processStratuxMetar(wxitem);
            break;
        case "WINDS":
            console.log("WINDS:", wxitem);
            processStratuxMetar(wxitem);
        case "TAF": 
        case "TAF.AMD":  
            console.log("TAF:", wxitem);
            processStratuxTAF(wxitem);            
            break;
        case "PIREP":
            console.log("PIREP:", wxitem);
            processStratuxPirep(wxitem);
            break;
    }
}

function processStratuxMetar(metar) {
    try {
        let svg = "";
        let svg2 = ""; 
        svg = weatherItemToSVG(metar, 150, 150, settings.usemetricunits);
        svg2 = getWindBarbSvg(95, 95, metar); 
        
        let airport = findAirportByICAO(metar.station);

        if (airport != undefined || airport != null) {
            const coords = fromLonLat([airport.lon, airport.lat]);
            const pointFeature = new Feature({
                geometry: new Point(coords),
                metar: metar,
                datatype: "metar",
                svgimage: svg
            });
            pointFeature.setId(metar.station);

            const icon = new Icon({
                crossOrigin: 'anonymous',
                src: `data:image/svg+xml;utf8,${encodeURIComponent(svg2)}`,
                scale: 1
            })

            const inlineSvgStyle = new Style({
                image: icon 
            });

            pointFeature.setStyle(inlineSvgStyle);
            
            let featureSource = metarVectorLayer.getSource();
            let features = featureSource.getFeatures();
            let maxmetars = settings.stratuxmaxmetarcount - 1;
            if (features.length > settings.maxmetarcount) {
                for (let i = features.length - 1; i >= maxmetars; i--) {
                    console.log("Trimming Features over count of 200 maximim");
                    featureSource.removeFeature(features[i]);
                } 
            }
            let feature = featureSource.getFeatureById(metar.station);
            if (feature === undefined || feature === null) {
                featureSource.addFeature(pointFeature);
            }
            else {
                feature = pointFeature;
            }
            pointFeature.changed();
        }true
    }
    catch(error) 
    { 
        console.error("Error:", error);
    }
}

function parseStandardMetar(raw) {
    // Remove trailing '=' and trim
    raw = raw.replace('=', '').trim();
    const parts = raw.split(/\s+/);

    let obj = {
        station: parts[0],
        wind: null,
        visibility: null,
        clouds: [],
        temperature_c: null,
        dewpoint_c: null,
        altimeter: null
    };

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        // Wind
        if (/^(VRB|\d{3})\d{2}KT$/.test(part)) {
            let match = part.match(/^(VRB|\d{3})(\d{2})KT$/);
            obj.wind = {
                direction: match[1] === 'VRB' ? 'VRB' : parseInt(match[1], 10),
                speed: parseInt(match[2], 10),
                unit: 'KT'
            };
        }
        // Visibility
        else if (/^\d{1,2}SM$/.test(part)) {
            obj.visibility = parseInt(part.replace('SM', ''), 10);
        }
        // Clouds
        else if (/^(FEW|SCT|BKN|OVC|VV)\d{3}$/.test(part)) {
            let match = part.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})$/);
            obj.clouds.push({
                type: match[1],
                altitude_ft: parseInt(match[2], 10) * 100
            });
        }
        // Temperature/Dewpoint
        else if (/^\d{2}\/\d{2}$/.test(part)) {
            let match = part.match(/^(\d{2})\/(\d{2})$/);
            obj.temperature_c = parseInt(match[1], 10);
            obj.dewpoint_c = parseInt(match[2], 10);
        }
        // Altimeter
        else if (/^A\d{4}$/.test(part)) {
            obj.altimeter = parseFloat(part.substring(1, 3) + '.' + part.substring(3, 5));
        }
    }
    return obj;
}

// Example usage:
const metarRaw = "KALN VRB05KT 10SM SCT046 BKN055 BKN090 32/22 A2988=";
console.log(parseStandardMetar(metarRaw));
const tafSvg = `<svg width="126.713" height="89.273" viewBox="0 0 33.526 23.62" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-.143 -.036)"><path style="fill:#690039;fill-opacity:1;stroke:#000;stroke-width:1.32292;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1" d="M32.995 11.846A16.095 11.149 0 0 1 16.96 22.995 16.095 11.149 0 0 1 .805 11.928 16.095 11.149 0 0 1 16.72.698a16.095 11.149 0 0 1 16.272 10.983l-16.093.165z"/><rect style="fill:#690039;fill-opacity:1;stroke:none;stroke-width:2.44876;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1" width="17.563" height="1.608" x="14.711" y="10.95" ry=".023"/><text xml:space="preserve" style="font-style:normal;font-variant:normal;font-weight:700;font-stretch:normal;font-size:14.0011px;line-height:1.25;font-family:sans-serif;-inkscape-font-specification:'sans-serif, Bold';font-variant-ligatures:normal;font-variant-caps:normal;font-variant-numeric:normal;font-variant-east-asian:normal;letter-spacing:0;word-spacing:0;fill:#ff0;fill-opacity:1;stroke:none;stroke-width:.350027" x="3.968" y="17.218" transform="scale(.9472 1.05574)"><tspan style="font-style:normal;font-variant:normal;font-weight:700;font-stretch:normal;font-size:14.0011px;font-family:sans-serif;-inkscape-font-specification:'sans-serif, Bold';font-variant-ligatures:normal;font-variant-caps:normal;font-variant-numeric:normal;font-variant-east-asian:normal;fill:#ff0;fill-opacity:1;stroke-width:.350027" x="3.968" y="17.218">TAF</tspan></text></g></svg>`;
function processStratuxTAF(taf) {
    let airport = findAirportByICAO(taf.station);
    if (airport != undefined || airport != null) {
        const coords = fromLonLat([airport.lon, airport.lat]);
        let tafFeature = new Feature({
            geometry: new Point(coords),
            taf: taf, // the taf json object
            raw_taf: taf.wxRawItem, // used in displayTafPopup(feature);
            datatype: "taf"
        });
        tafFeature.setId(taf.station);
        
        const icon = new Icon({
            crossOrigin: 'anonymous',
            src: "/images/taf.png", // `data:image/svg+xml;utf8,${encodeURIComponent(tafSvg)}`,
            size:[126,90],
            offset: [0,0],
            opacity: 1,
            scale: .20
        });

        const iconStyle = new Style({
            image: icon
        });

        let featureSource = tafVectorLayer.getSource();
        let features = featureSource.getFeatures();
        let maxtafs = 100;
        if (features.length > maxtafs) {
            for (let i = features.length - 1; i >= maxtafs -1; i--) {
                console.log("Trimming TAF Features over count of 100 maximim");
                featureSource.removeFeature(features[i]);
            } 
        }
        tafFeature.setStyle(iconStyle);
        featureSource.addFeature(tafFeature);
        tafFeature.changed();
    }
}

const pirepSvg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="650" height="700"><path d="m293.301 160.266.23 66.375-69.156 56.187V255.86h-23.094v46.532l-70.796 59.528-108.11 92.41-7.781 35.78 191.375-104.25 87.125-23.343 1.562 154.03 17.094 73.126-90.906 68.625v29.406l104.312-22.156 104 22.094v-29.407L338.25 589.61l17.094-73.125 1.562-154.03 87.125 23.343 191.375 104.25-7.781-35.781-107.164-91.403-71.742-60.535v-46.531h-23.094v26.969l-70.933-56.188.007-66.375c0-27.014.991-111.224-29.418-147.906-29.396 41.87-30.385 96.99-31.98 147.969z" style="opacity:1;color:#000;fill:#98294c;fill-opacity:1;fill-rule:nonzero;stroke:#000;stroke-width:4;stroke-linecap:round;stroke-linejoin:miter;marker:none;marker-start:none;marker-mid:none;marker-end:none;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;visibility:visible;display:inline;overflow:visible"/></svg>`;
function processStratuxPirep(pirep) {
        
    // generate a "pseudo-heading" to use if wind dir is absent
    let heading = Math.random()*Math.PI*2;
    if (pirep.wind.direction) {
        heading = (pirep.wind.direction * 0.0174533);
    }
    let pirepFeature = new Feature({
        ident: pirep.station,
        pirep: pirep,
        datatype: "pirep",
        geometry: new Point(fromLonLat([pirep.longitude, pirep.latitude])),
    });
    pirepFeature.setId(pirep.station);

    const icon = new Icon({
        crossOrigin: 'anonymous',
        src: '/images/pirep.png',
        //size:[85, 85],
        offset: [0,0],
        opacity: 1,
        scale: .05
    });

    const iconStyle = new Style({
        image: icon
    });

    let featureSource = pirepVectorLayer.getSource();
    pirepFeature.setStyle(iconStyle);
    featureSource.addFeature(pirepFeature);
    pirepFeature.changed();
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
 *
 * @param rawWxItem raw metar string
 * @param metric true for metric units(m, hPa, mps), false for north american units (miles, inHg, Kts)

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
    let metar = feature.get("metar");
    let rawmetar = metar.rawWxItem;
    let parsedwx = parseRawAviationMetar(rawmetar);
    let ident = metar.station;
    let svg = feature.get("svgimage");
    let cat = metar.flightCategory;
    if (cat == undefined || cat == "undefined"){
        cat = "VFR";
    }
    let time = metar.observation_time;
    if (settings.uselocaltime) {
        time = getLocalTime(time);
    }
    let tempC = metar.temp_c;
    let dewpC = metar.dewpoint_c;
    let temp = convertCtoF(metar.temp_c);
    let dewp = convertCtoF(metar.dewpoint_c);
    let windir = `${metar.wind.directon}`;
    let winspd = `${metar.wind.speed}${metar.wind.unit}`;
    let wingst = `${metar.wind.gust}${metar.wind.unit}`; 
    let altim = getAltimeterSetting(metar.altimeter);
    let vis = getDistanceUnits(metar.visibility);
    //let wxcode = rawmetar!== undefined ? decodeWxDescriptions(rawmetar) : "";
    let taflabelCssClass = "taflabel"
    let skycondition = metar.sky_condition;
    let skyconditions;
    let icingconditions;
    if (skycondition !== undefined) {
        skyconditions = decodeSkyCondition(skycondition, taflabelCssClass);
    }
    let icingcondition = metar.icing_condition;
    if (icingcondition !== undefined) {
        icingconditions = decodeIcingOrTurbulenceCondition(icingcondition, taflabelCssClass);
    }
    
    let label = `<div class="#class">`;
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
    if (ident != "undefined") {
        let name = getFormattedAirportName(ident);
        let html = `<div id="#featurepopup"><pre><code><p>`
        html +=    `${css}${name}\n${ident} - ${cat}</div><p></p>`;
        html +=   (time != "" && time != "undefined") ? `Time:&nbsp<b>${time}</b><br/>` : "";
        html +=   (temp != "" && temp != "undefined") ? `Temp:&nbsp<b>${tempC} °C</b> (${temp})<br/>` : "";
        html +=   (dewp != "" && dewp != "undefined") ?`Dewpoint:&nbsp<b>${dewpC} °C</b> (${dewp})<br/>` : "";
        html += (windir != "" && windir != "undefined") ? `Wind Direction:&nbsp<b>${windir}°</b><br/>` : "";
        html += (winspd != "" && winspd != "undefined") ? `Wind Speed:&nbsp<b>${winspd}&nbspkt</b><br/>` : "";
        html += (wingst != "" && wingst != "undefined") ? `Wind Gust:&nbsp<b>${wingst}&nbspkt</b><br/>` : "";
        html +=  (altim != "" && altim != "undefined") ? `Altimeter:&nbsp<b>${altim}&nbsphg</b><br/>` : "";
        html +=    (vis != "" && vis != "undefined") ? `Horizontal Visibility:&nbsp<b>${vis}</b><br/>` : "";
        html += (wxcode != "" && wxcode != "undefined") ? `Weather:&nbsp<b>${wxcode}</b><br/>`: "";
        html += (skyconditions != undefined && skyconditions != "") ? `${skyconditions}` : "";
        html += (icingconditions != undefined && icingconditions != "") ? `${icingconditions}` : "";
        html += `</p></code></pre><span class="windsvg">${svg}</span>`;
        html += `<textarea id="rawdata" class="rawdata">${rawmetar}</textarea><br>`; 
        html += `<p><button class="ol-popup-closer">close</button></p></div>`;
        popupcontent.innerHTML = html;  
    }
}

function parseRawAviationMetar(raw) {
    // Split lines and clean up whitespace
    const lines = raw.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // First line: station, FT, altitudes
    const headerParts = lines[0].split(/\s+/);
    const station = headerParts[0];
    // Find all altitude numbers after "FT"
    const altitudes = [];
    for (let i = 2; i < headerParts.length; i++) {
        if (/^\d+$/.test(headerParts[i])) {
            altitudes.push(parseInt(headerParts[i], 10));
        }
    }

    // Second line: wind/temp groups
    const dataParts = lines[1].split(/\s+/).filter(Boolean);

    // Parse each group
    const levels = [];
    for (let i = 0; i < altitudes.length; i++) {
        const group = dataParts[i];
        if (!group) continue;
        let windDir = null, windSpeed = null, temp = null;
        // Match patterns like 2714+17 or 2523-05 or 2319
        const match = group.match(/^(\d{2,3})(\d{2})([+-]\d+)?$/);
        if (match) {
            windDir = parseInt(match[1], 10);
            windSpeed = parseInt(match[2], 10);
            temp = match[3] ? parseInt(match[3], 10) : null;
        } else {
            // Sometimes temp is missing, just wind dir/speed
            const match2 = group.match(/^(\d{2,3})(\d{2})$/);
            if (match2) {
                windDir = parseInt(match2[1], 10);
                windSpeed = parseInt(match2[2], 10);
            }
        }
        levels.push({
            altitude_ft: altitudes[i],
            wind_direction_deg: windDir,
            wind_speed_kt: windSpeed,
            temperature_c: temp
        });
    }

    return {
        station,
        levels
    };
}

/**
 * Create the html for a TAF popup element
 * @param {feature} ol.Feature: the taf feature the user clicked on
 */
function displayTafPopup(feature) {
    let taf = feature.get("taf");
    let rawtaf = taf.rawWxItem;
    let outerhtml = `<div class="taftitle">` + 
                        `<label class="taftitlelabel">Terminal Area Forecast - ${feature.get("ident")}</label>` +
                    `</div>` +
                    `<div class="taf">` + 
                        `<pre><code>` +
                        `<table class="tafmessage" id="taftable">` +
                            `<tr class="tafbody">` + 
                                `<td id="tafdata">###</td>` +
                            `</tr>` +
                        `</table>` +
                        `</code></pre>` +                 
                    `</div>` + 
                    `<br /><br />`;

    let html = "<div>";
    
    for (const item in taf.forecast) {
        let value = taf.forecast[item];
        if (typeof(value) === 'object') {
            for (const subitem in value) {
                let subvalue = value[subitem];
                html += parseForecast(subitem, subvalue);
            }
            html += "</p><hr>";
        } 
        else {
            html += parseForecast(item, value);
        }
    }
    
    html += `</p></div><textarea class="rawdata">${rawtaf}</textarea><br />`;
    html += `<p><button class="ol-popup-closer">close</button></p></div>`;
    let innerhtml = outerhtml.replace("###", html);
    popupcontent.innerHTML = innerhtml;
}

/**
 * Create the html for a PIREP popup element
 * @param {object} feature: the pirep the user clicked on
 */
 function displayPirepPopup(feature) {
    let pirep = feature.get("pirep");
    let rawaircraftreport = pirep.rawWxItem;
    let outerhtml = `<div class='taftitle'>` + 
                        `<div class='taftitlelabel'>${pirep.type} FROM AIRCRAFT ${pirep.station}</div><p></p>` +
                    `</div>` +
                    `<div class='taf'>` + 
                        `<pre><code>` +
                        `<table class='tafmessage' id='taftable'>` +s
                            `<tr class='tafbody'>` + 
                                `<td id='tafdata'>###</td>` +
                            `</tr>` +
                        `</table>` +
                        `</code></pre>` +                 
                    `</div>` + 
                    `<br/><br/>`;

    let html = "<div>";
    let pireplabel = `<div class='pirepitem'>`
    let thistime = "";
    for (const pirepkey in pirep) {
        let pirepvalue = pirep[pirepkey];
        let fieldname = getFieldDescription(pirepkey);
        switch (pirepkey) {
            case "receipt_time":
                thistime = pirepvalue;
                if (settings.uselocaltime) {
                    thistime = getLocalTime(pirepvalue);
                }
                html += `${pireplabel}${fieldname}: <b>${thistime}</b></div><br />`;
                break;
            case "observation_time":
                thistime = pirepvalue;
                if (settings.uselocaltime) {
                    thistime = getLocalTime(pirepvalue);
                }
                html += `${pireplabel}${fieldname}: <b>${thistime}</b></div><br />`;
                break;
            case "latitude":
            case "longitude":
            case "altitude_ft_msl":
            case "temp_c":
            case "dewpoint_c":
            case "time_becoming":
            case "probability":
            case "wind_speed_kt":
            case "wind_gust_kt":
            case "wind_dir_degrees":
            case "wind_shear_dir_degrees":
            case "wind_shear_hgt_ft_agl":
            case "wind_shear_speed_kt":
            case "vert_vis_ft":
            case "visibility_statute_mi":
                html += `${pireplabel}${fieldname}: <b>${pirepvalue}°</b></div><br/>`;
                break;
            case "sky_condition":
                html += `<label class="pirepskyheader">${fieldname}</div><br/>`;
                html += decodeSkyCondition(pirepvalue, "pirepitem");
                html += "<hr>";
                break;
            case "turbulence_condition":
            case "icing_condition":
                html += `<div class="pirepskyheader">${fieldname}</div><br/>`;
                html += decodeIcingOrTurbulenceCondition(pirepvalue, "pirepitem");
                html += "<hr>";
                break;
            case "temperature":
                html += `<div class="pirepskyheader">Weather</div><br/>`;
                break;
            case "altim_in_hg":
                let altimvalue = getInchesOfMercury(pirepvalue);
                html += `<div class="pirepitem">${fieldname}: <b>${altimvalue}</b></div><br/>`;
                break;
            case "wx_string":
                let lineval = decodeWxDescriptions(pirepvalue);
                html += `<div class="pirepitem">${fieldname}: <b>${lineval}</b></div><br/>`;
                break;
            case "change_indicator":
                let change = getSkyConditionDescription(pirepvalue);
                html += `<div class="pirepitem">${fieldname}: <b>${change}</b></div><br/>`;
                break;
            case "pirep_type":
            case "aircraft_ref":
            case "raw_text":
                break;
            default:
                console.log(`${pirepkey} NOT FOUND!`);
                break;
        }
    }
    html += `</p></div><textarea class="rawdata">${rawaircraftreport}</textarea>`;
    html += `<p><button class="ol-popup-closer">close</button></p></div>`;
    let innerhtml = outerhtml.replace("###", html);
    popupcontent.innerHTML = innerhtml;
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

function buildRecentWeatherJsonObject() {
    let wxJson = {
        REBLSN: "Moderate/heavy blowing snow (visibility significantly reduced)reduced",
        REDS: "Dust Storm",
        REFC: "Funnel Cloud",
        REFZDZ: "Freezing Drizzle",
        REFZRA: "Freezing Rain",
        REGP: "Moderate/heavy snow pellets",
        REGR: "Moderate/heavy hail",
        REGS: "Moderate/heavy small hail",
        REIC: "Moderate/heavy ice crystals",
        REPL: "Moderate/heavy ice pellets",
        RERA: "Moderate/heavy rain",
        RESG: "Moderate/heavy snow grains",
        RESHGR: "Moderate/heavy hail showers",
        RESHGS: "Moderate/heavy small hail showers",
        // RESHGS: "Moderate/heavy snow pellet showers", // dual meaning?
        RESHPL: "Moderate/heavy ice pellet showers",
        RESHRA: "Moderate/heavy rain showers",
        RESHSN: "Moderate/heavy snow showers",
        RESN: "Moderate/heavy snow",
        RESS: "Sandstorm",
        RETS: "Thunderstorm",
        REUP: "Unidentified precipitation (AUTO obs. only)",
        REVA: "Volcanic Ash",
    };
    return wxJson;
};


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

//Meassage types
var TYPES = ["METAR", "SPECI"];

/**
 * Parses a raw metar and binds or creates a METAR object
 * @param wxItem Reference to a METAR object. This objects contents will be shallow replaced with the Raw metars values.
 *  Meaning values will be updated or added but not removed.
 * @returns
 */
function parseWeatherItem(wxItem) {
    try {
        var rawWxItem = wxItem.rawWxItem;
        // extract all of the weather abbreviations
        // and values into the WEATHER dictionary,
        // with the abbreviation as the key.
        var obs_keys = Object.keys(WEATHER).join('|').replace(/\+/g, "\\+");
        var re = new RegExp("\\s?(" + obs_keys + ")\\s", 'g');
        var matches = rawWxItem.match(re);
        if (matches != null && matches.length > 0) {
            for (let i=0; i < matches.length; i++) {
                let fld = matches[i].trim();
                wxItem.forecast += parseForecast(fld, rawWxItem);
            }
            console.log("MATCHES:", matches);
        }
        var time = parseDate(rawWxItem);
        wxItem.time = time;
        wxItem.auto = parseAuto(rawWxItem);
        wxItem.wind = parseWind(rawWxItem);
        wxItem.cavok = parseCavok(rawWxItem);
        wxItem.clouds = parseClouds(rawWxItem);
        
        var temps_int = parseTempInternational(rawWxItem);
        if (temps_int != null) {
            wxItem.temperature = temps_int[0];
            wxItem.dewpoint = temps_int[1];
        }
        var temps_ne = parseTempNorthAmerica(rawWxItem);
        if (temps_ne != null) {
            wxItem.temperature = temps_ne[0];
            wxItem.dewpoint = temps_ne[1];
        }
        wxItem.altimeter = parseAltimeter(rawWxItem);
        wxItem.visibility = parseVisibility(rawWxItem);
    }
    catch {
        //console.log("ERROR IN parseMetar() starting at line 2985");
    }
}

function parseAltimeter(rawWxItem) {
    var re = /(A|Q)(\d{2})(\d{2})/g;
    var matches = re.exec(rawWxItem);
    if (matches != null) {
        if (matches[1] === "Q") {
            var pressure = parseFloat(matches[2] + matches[3]);
            return parseFloat((pressure * 0.029529).toFixed(2));
        }
        else {
            return parseFloat(matches[2] + "." + matches[3]);
        }
    }
    else {
        return 29.92;
    }
}

/**
 * Parse Date object from metar.
 * NOTE: Raw metar data does not contain month or year data. So this function assumes this metar was created in the current month and current year
 * @param rawWxItem raw metar
 * @returns
 */
function parseDate(rawWxItem) {
    var re = /([\d]{2})([\d]{2})([\d]{2})Z/g;
    var matches = re.exec(rawWxItem);
    var d = new Date();
    if (matches != null) {     
        d.setUTCDate(parseInt(matches[1]));
        d.setUTCHours(parseInt(matches[2]));
        d.setUTCMinutes(parseInt(matches[3]));
        d.setUTCSeconds(0);
        d.setUTCMilliseconds(0);
    }
    return d;
}


/**
 * Parses for Automation
 * @param rawWxItem raw metar
 * @returns
 */
function parseAuto(rawWxItem) {
    var re = /\s(AUTO)?(AO1)?(AO2)?\s/g;
    return rawWxItem.match(re) != null ? true : false;
}

/**
 * Parse wind data
 * @param rawWxItem raw metar
 * @returns
 */
function parseWind(wxItem) {
    var wind = new Wind();
    try {
        var re = /\s(\d{3})(\d{2})(G)?(\d{2})?(KT|MPS)\s/g;
        var matches = re.exec(wxItem.rawWxItem);
        if (matches != null) {
            wind.direction = parseInt(matches[1]);
            wind.speed = parseInt(matches[2]);
            wind.unit = matches[5];
            wxItem.wind = wind;
        }
    }
    finally{}
    return wind;
}

/**
 * Parses for CAVOK (Ceiling and visabiliy OK)
 * @param rawWxItem raw metar
 * @returns
 */
function parseCavok(rawWxItem) {
    var re = /\sCAVOK\s/g;
    return rawWxItem.match(re) != null ? true : false;
}

/**
 * Parse visibility
 * @param rawWxItem raw metar
 * @returns
 */
function parseVisibility(rawWxItem) {
    var re = /\s([0-9]{1,2})?\s?([0-9]{1}\/[0-9]{1})?(SM)\s|\s([0-9]{1,4})\s/g;
    if (rawWxItem.match(re)) {
        var vis_parts = re.exec(rawWxItem);
        if (vis_parts != null) {
            var meters = vis_parts[4];
            var miles = vis_parts[1];
            var frac_miles = vis_parts[2];
            //Metric case ex: 1000, 9999 
            if (meters != null && meters != undefined) {
                return parseInt(meters);
            }
            //whole miles case ex: 1SM 10SM
            else if (frac_miles != null && frac_miles != undefined) {
                var total = 0.0;
                if (miles != null && miles != undefined) {
                    total += parseFloat(miles);
                }
                let sfm = frac_miles.split("/");
                if (sfm.length > 1) {
                    let fm = parseFloat(sfm[0]) / parseFloat(sfm[1])
                    total += fm;
                }
                else {
                    total += parseFloat(frac_miles);
                }
                return total * 1609.34; //factional miles case "1 1/2SM" "1/4SM"
            }
            else {
                return parseInt(miles); 
            }
        }
    }
    return undefined; 
}

/**
 * Parse forcast fields from metars or tafs
 * @param {string} rawfieldname - the object key before "cleaning" underscores, etc.
 * @param {object} fieldvalue json object corresponding to the key
 * @returns 
 */
function parseForecastItem(rawfieldname, fieldvalue) {
    let fieldname = tafFieldKeymap.get(rawfieldname);
    let html = "";
    let formattedvalue = "";
    switch (fieldname) {
        case "fcst_time_from":
            let thistime = fieldvalue;
            if (settings.uselocaltime) {
                thistime = getLocalTime(fieldvalue);
            }
            html = `<div class="fcstlabel"><b>${thistime}</b></div></b><br>`;
            break;
        case "fcst_time_to": // I'm going to ignore this field to save space on the popup
            //html = `&nbspto&nbsp<b>${fieldvalue}</b></label><br>`
            //html = `<label class="fcstlabel">${formattedvalue}</label><br>`;
            break;
        case "change_indicator":
            let changevalue = getWeatherAcronymDescription(fieldvalue);
            html = `<div class="taflabel">${fieldname}: <b>${changevalue}</b></div><br>`;
            break;
        case "temperature":
        case "time_becoming":
        case "probability":
        case "wind_speed_kt":
        case "wind_gust_kt":
        case "wind_shear_hgt_ft_agl":
        case "wind_shear_speed_kt":
        case "altim_in_hg":
        case "vert_vis_ft":
        case "wx_string":
            if (fieldname === "wx_string") {
                formattedvalue = decodeWxDescriptions(fieldvalue);
                html = `<div class="tafwxlabel">${fieldname}: <b>${formattedvalue}</b></div><br>`;
            }
            else {
                html = `<div class="taflabel">${fieldname}: <b>${fieldvalue}</b></div><br>`;
            }
            break;
        case "sky_condition":
            formattedvalue = decodeSkyCondition(fieldvalue);
            html = `<div class="tafskyheader">${fieldname}</div><br>${formattedvalue}`;
            break;
        case "turbulence_condition":
        case "icing_condition":
            formattedvalue = decodeIcingOrTurbulenceCondition(fieldvalue);
            html = `<div class="tafskyheader">${fieldname}</div><br>${formattedvalue}`;
            break;
        case "wind_dir_degrees":
        case "wind_shear_dir_degrees":
            html = `<div class="taflabel">${fieldname}: <b>${fieldvalue} Degrees</b></div><br>`;
            break;

    }
    return html;
}

/**
 * Parse cloud coverages
 * @param rawWxItem raw metar
 * @returns
 */
function parseClouds(rawWxItem) {
    var _a;
    var re = /(NCD|SKC|CLR|NSC|FEW|SCT|BKN|OVC|VV)(\d{3})/g;
    var clouds = new Array();
    var matches;
    while ((matches = re.exec(rawWxItem)) != null) {
        var cloud = {
            abbreviation: matches[1],
            meaning: (_a = CLOUDS[matches[1]]) === null || _a === void 0 ? void 0 : _a.text,
            altitude: parseInt(matches[2]) * 100
        };
        clouds.push(cloud);
    }
    return clouds;
}

/**
 * Parse Weather items
 * @param metar raw metar
 * @returns
 */
function parseWeatherKeyValues(rawWxItem) {
    var obs_keys = Object.keys(WEATHER).join('|').replace(/\+/g, "\\+");
    var re = new RegExp("\\s?(" + obs_keys + ")\\s", 'g');
    var matches = rawWxItem.match(re);
    if (matches != null) {
        return matches.map(function (match) {
            var key = match.trim();
            return {
                abbreviation: key,
                meaning: WEATHER[key].text
            };
        });
    }
    else {
        return new Array();
    }
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
 * Decode sky conditions
 * @param {object} json object skyconditions 
 * @param {string} css class to use 
 * @returns html string 
 */
 function decodeSkyCondition(skycondition, labelclassCss) {
    let html = "";
    if (skycondition !== undefined) {
        try {
            let values = Object.values(skycondition);
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
    }
    return html;
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
 * Decode weather codes from TAFs or METARS
 * @param {*} codevalue: this could contain multiple space-delimited codes
 * @returns string with any weather description(s)
 */
 function decodeWxDescriptions(codevalue) {
    let outstr = "";
    let vals = codevalue.split(" ");
    
    for (let i = 0; i < vals.length; i++) {
        if (i === 0) {
            outstr = weatherAcronymKeymap.get(vals[i]);
        }
        else {
            outstr += ` / ${weatherAcronymKeymap.get(vals[i])}`;
        }
    }
    return outstr;
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
 * Parse an icing or turbulence condition field value, 
 * which could be an object or a string and return html
 * @param {string} rawfieldname 
 * @param {object} fieldvalue 
 * @returns html string
 */
function parseConditionField(rawfieldname, fieldvalue) {
    let fieldname = getFieldDescription(rawfieldname);
    let image = "";
    let html = "";
    switch (rawfieldname) {
        case "turbulence_type":
        case "icing_type":
            html += `<label class="pirepitem">${fieldname}: <b>${fieldvalue}</b></label><br />`;
            break; 
        case "turbulence_intensity":
        case "icing_intensity":
            image = getConditionImage(rawfieldname, fieldvalue);
            html += `<label class="pirepitem">${fieldname}</label>`;
            html += `<div class="conditionimage"><image src="${URL_SERVER}/img/${image}"></div><br />`;
            break;
        case "turbulence_base_ft_msl":
        case "icing_base_ft_msl":
            html += `<label class="pirepitem">${fieldname}: <b>${fieldvalue}</b></label><br />`;
            break;
        case "turbulence_top_ft_msl":
        case "icing_top_ft_msl":
            html += `<label class="pirepitem">${fieldname}: <b>${fieldvalue}</b></label></br />`;
            break;
        default:
            break;
    }
    return html;
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

/**
 * Load normalized metar field names
 */
 function loadMetarFieldKeymap() {
    metarFieldKeymap.set("change_indicator", "Change indicator");
    metarFieldKeymap.set("raw_text", "raw text");
    metarFieldKeymap.set("station_id", "station id"); 
    metarFieldKeymap.set("observation_time", "Observation Time");
    metarFieldKeymap.set("latitude", "latitude");
    metarFieldKeymap.set("longitude", "longitude");
    metarFieldKeymap.set("temp_c", "Temp °C");
    metarFieldKeymap.set("dewpoint_c", "Dewpoint °C");
    metarFieldKeymap.set("wind_dir_degrees", "Wind direction"); 
    metarFieldKeymap.set("wind_speed_kt", "Wind speed knots");
    metarFieldKeymap.set("wind_gust_kt", "Wind gust knots");
    metarFieldKeymap.set("visibility_statute_mi", "Horizontal visibility in statute miles");
    metarFieldKeymap.set("altim_in_hg", "Altimeter in Hg");
    metarFieldKeymap.set("sea_level_pressure_mb", "Sea-level pressure in MB");
    metarFieldKeymap.set("quality_control_flags", "Quality control flags");
    metarFieldKeymap.set("wx_string", "Weather");
    metarFieldKeymap.set("sky_condition", "Sky cover");
    metarFieldKeymap.set("sky_cover", "Sky cover");
    metarFieldKeymap.set("cloud_base_ft_agl", "Cloud base feet AGL");
    metarFieldKeymap.set("cloud_base", "Cloud base");
    metarFieldKeymap.set("flight_category", "Flight category");
    metarFieldKeymap.set("three_hr_pressure_tendency_mb", "Pressure change past 3 hours in MB");
    metarFieldKeymap.set("maxT_c", "Max air temp °C, past 6 hours");
    metarFieldKeymap.set("minT_c", "Min air temp °C, past 6 hours");
    metarFieldKeymap.set("maxT24hr_c", "Max air temp °C, past 24 hours");
    metarFieldKeymap.set("minT24hr_c", "Min air temp °C, past 24 hours");
    metarFieldKeymap.set("precip_in", "Liquid precipitation since last METAR");
    metarFieldKeymap.set("pcp3hr_in", "Liquid precipitation past 3 hours");
    metarFieldKeymap.set("pcp6hr_in", "Liquid precipitation past 6 hours");
    metarFieldKeymap.set("pcp24hr_in", "Liquid precipitation past 24 hours");
    metarFieldKeymap.set("snow_in", "Snow depth in inches");
    metarFieldKeymap.set("vert_vis_ft", "Vertical visibility in feet");
    metarFieldKeymap.set("metar_type", "Metar type");
    metarFieldKeymap.set("elevation_m", "Station elevation in meters");
}

/**
 * Get the description for a TAF fieldname abbreviation
 * @param {string} fieldname 
 * @returns string, readable description of fieldname 
 */
 function getFieldDescription(fieldname) {
    let retvalue = fieldname;
    if (!Number.isInteger(fieldname)) {
        retvalue = tafFieldKeymap.get(fieldname);
        if (retvalue === undefined) {
            retvalue = fieldname;
        }
    }
    return retvalue;
}

/**
 * Load normalized TAF field names
 */
function loadTafFieldKeymap() {
    tafFieldKeymap.set("temp_c", "Temperature °C");
    tafFieldKeymap.set("icing_type", "Icing type");
    tafFieldKeymap.set("pirep_type", "Pirep type");
    tafFieldKeymap.set("altitude_ft_msl", "Altitude in feet MSL");
    tafFieldKeymap.set("receipt_time", "Receipt time")
    tafFieldKeymap.set("observation_time", "Observation time")
    tafFieldKeymap.set("latitude", "Latitude")
    tafFieldKeymap.set("longitude", "Longitude")
    tafFieldKeymap.set("cloud_type", "Cloud type");
    tafFieldKeymap.set("fcst_time_from", "Time from");
    tafFieldKeymap.set("fcst_time_to", "Time to");
    tafFieldKeymap.set("change_indicator", "Change indicator");
    tafFieldKeymap.set("time_becoming", "Time becoming");
    tafFieldKeymap.set("probability", "Probability");
    tafFieldKeymap.set("wind_dir_degrees", "Wind Direction");
    tafFieldKeymap.set("wind_speed_kt", "Wind Speed knots");
    tafFieldKeymap.set("wind_gust_kt", "Wind Gust knots");
    tafFieldKeymap.set("wind_shear_hgt_ft_agl", "Shear height feet AGL");
    tafFieldKeymap.set("wind_shear_dir_degrees", "Shear direction");
    tafFieldKeymap.set("wind_shear_speed_kt", "Shear speed knots");
    tafFieldKeymap.set("altim_in_hg", "Altimeter (Hg)");
    tafFieldKeymap.set("vert_vis_ft", "Vertical visibility in feet");
    tafFieldKeymap.set("visibility_statute_mi", "Horizontal visibility in statute miles");
    tafFieldKeymap.set("wx_string", "Weather");
    tafFieldKeymap.set("sky_condition", "Sky condition");
    tafFieldKeymap.set("icing_condition", "Icing condition");
    tafFieldKeymap.set("turbulence_condition", "Turbulence condition");
    tafFieldKeymap.set("sky_cover", "Sky cover");
    tafFieldKeymap.set("cloud_base_ft_agl", "Cloud base feet AGL");
    tafFieldKeymap.set("cloud_base_ft_msl", "Cloud base feet MSL");
    tafFieldKeymap.set("cloud_base", "Cloud base");
    // icing fieldnames
    tafFieldKeymap.set("icing_intensity", "Intensity");
    tafFieldKeymap.set("icing_min_alt_ft_agl", "Min altitude feet AGL");
    tafFieldKeymap.set("icing_max_alt_ft_agl", "Max altitude feet AGL");
    tafFieldKeymap.set("icing_min_alt_ft_msl", "Min altitude feet MSL");
    tafFieldKeymap.set("icing_max_alt_ft_agl", "Max altitude feet MSL");
    tafFieldKeymap.set("icing_type", "Type");
    tafFieldKeymap.set("icing_top_ft_msl", "Top in feet MSL");
    tafFieldKeymap.set("icing_base_ft_msl", "Base in feet MSL");
    // turbulence fieldnames
    tafFieldKeymap.set("turbulence_intensity", "Intensity");
    tafFieldKeymap.set("turbulence_min_alt_ft_agl", "Min altitude feet AGL");
    tafFieldKeymap.set("turbulence_max_alt_ft_agl", "Max altitude feet AGL");
    tafFieldKeymap.set("turbulence_freq", "Frequency");
    tafFieldKeymap.set("turbulence_type", "Type");
    tafFieldKeymap.set("turbulence_top_ft_msl", "Top in feet MSL");
    tafFieldKeymap.set("turbulence_base_ft_msl", "Base in feet MSL");
}

/**
 * Load the wxkeymap Map object with weather code descriptions
 */
function loadWeatherAcronymKeymap() {
    weatherAcronymKeymap.set("FM", "From");
    weatherAcronymKeymap.set("TEMPO", "Temporary");
    weatherAcronymKeymap.set("BECMG", "Becoming");
    weatherAcronymKeymap.set("PROB", "Probability");
    weatherAcronymKeymap.set("FU", "Smoke");
    weatherAcronymKeymap.set("VA", "Volcanic Ash");
    weatherAcronymKeymap.set("HZ", "Haze");
    weatherAcronymKeymap.set("DU", "Dust");
    weatherAcronymKeymap.set("SA", "Sand");
    weatherAcronymKeymap.set("BLDU", "Blowing dust");
    weatherAcronymKeymap.set("BLSA", "Blowing sand");
    weatherAcronymKeymap.set("PO", "Dust devil");
    weatherAcronymKeymap.set("VCSS", "Vicinity sand storm");
    weatherAcronymKeymap.set("BR", "Mist or light fog");
    weatherAcronymKeymap.set("MIFG", "More or less continuous shallow fog");
    weatherAcronymKeymap.set("VCTS", "Vicinity thunderstorm");
    weatherAcronymKeymap.set("VIRGA", "Virga or precipitation not hitting ground");
    weatherAcronymKeymap.set("VCSH", "Vicinity showers");
    weatherAcronymKeymap.set("TS", "Thunderstorm with or without precipitation");
    weatherAcronymKeymap.set("SQ", "Squalls");
    weatherAcronymKeymap.set("FC", "Funnel cloud or tornado");
    weatherAcronymKeymap.set("SS", "Sand or dust storm");
    weatherAcronymKeymap.set("+SS", "Strong sand or dust storm");
    weatherAcronymKeymap.set("BLSN", "Blowing snow");
    weatherAcronymKeymap.set("DRSN", "Drifting snow");
    weatherAcronymKeymap.set("VCFG", "Vicinity fog");
    weatherAcronymKeymap.set("BCFG", "Patchy fog");
    weatherAcronymKeymap.set("PRFG", "Fog, sky discernable");
    weatherAcronymKeymap.set("FG", "Fog, sky undiscernable");
    weatherAcronymKeymap.set("FZFG", "Freezing fog");
    weatherAcronymKeymap.set("-DZ", "Light drizzle");
    weatherAcronymKeymap.set("DZ", "Moderate drizzle");
    weatherAcronymKeymap.set("+DZ", "Heavy drizzle");
    weatherAcronymKeymap.set("-FZDZ", "Light freezing drizzle");
    weatherAcronymKeymap.set("FZDZ", "Moderate freezing drizzle");
    weatherAcronymKeymap.set("+FZDZ", "Heavy freezing drizzle");
    weatherAcronymKeymap.set("-DZRA", "Light drizzle and rain");
    weatherAcronymKeymap.set("DZRA", "Moderate to heavy drizzle and rain");
    weatherAcronymKeymap.set("-RA", "Light rain");
    weatherAcronymKeymap.set("RA", "Moderate rain");
    weatherAcronymKeymap.set("+RA", "Heavy rain");
    weatherAcronymKeymap.set("-FZRA", "Light freezing rain");
    weatherAcronymKeymap.set("FZRA", "Moderate freezing rain");
    weatherAcronymKeymap.set("+FZRA", "Heavy freezing rain");
    weatherAcronymKeymap.set("-RASN", "Light rain and snow");
    weatherAcronymKeymap.set("RASN", "Moderate rain and snow");
    weatherAcronymKeymap.set("+RASN", "Heavy rain and snow");
    weatherAcronymKeymap.set("-SN", "Light snow");
    weatherAcronymKeymap.set("SN", "Moderate snow");
    weatherAcronymKeymap.set("+SN", "Heavy snow");
    weatherAcronymKeymap.set("SG", "Snow grains");
    weatherAcronymKeymap.set("IC", "Ice crystals");
    weatherAcronymKeymap.set("PE PL", "Ice pellets");
    weatherAcronymKeymap.set("PE", "Ice pellets");
    weatherAcronymKeymap.set("PL", "Ice pellets");
    weatherAcronymKeymap.set("-SHRA", "Light rain showers");
    weatherAcronymKeymap.set("SHRA", "Moderate rain showers");
    weatherAcronymKeymap.set("+SHRA", "Heavy rain showers");
    weatherAcronymKeymap.set("-SHRASN", "Light rain and snow showers");
    weatherAcronymKeymap.set("SHRASN", "Moderate rain and snow showers");
    weatherAcronymKeymap.set("+SHRASN", "Heavy rain and snow showers");
    weatherAcronymKeymap.set("-SHSN", "Light snow showers");
    weatherAcronymKeymap.set("SHSN", "Moderate snow showers");
    weatherAcronymKeymap.set("+SHSN", "Heavy snow showers");
    weatherAcronymKeymap.set("-GR", "Light showers with hail, not with thunder");
    weatherAcronymKeymap.set("GR", "Moderate to heavy showers with hail, not with thunder");
    weatherAcronymKeymap.set("TSRA", "Light to moderate thunderstorm with rain");
    weatherAcronymKeymap.set("TSGR", "Light to moderate thunderstorm with hail");
    weatherAcronymKeymap.set("+TSRA", "Thunderstorm with heavy rain");
    weatherAcronymKeymap.set("UP", "Unknown precipitation");
    weatherAcronymKeymap.set("NSW", "No significant weather");
}

/**
 * Load readable descriptions for Turbulence codes
 */
function loadTurbulenceCodeKeymap() {
turbulenceCodeKeymap.set("0", "Light");
turbulenceCodeKeymap.set("1", "Light");
turbulenceCodeKeymap.set("2", "Moderate in clean air occasionally")
turbulenceCodeKeymap.set("3", "Moderate in clean air frequent");
turbulenceCodeKeymap.set("4", "Moderate in clouds occasionally");   
turbulenceCodeKeymap.set("5", "Moderate in clouds frequently");
turbulenceCodeKeymap.set("6", "Severe in clean air occasionally");
turbulenceCodeKeymap.set("7", "Severe in clean air frequent");
turbulenceCodeKeymap.set("8", "Severe in clouds occasionally");
turbulenceCodeKeymap.set("9", "Severe in clouds frequently");
turbulenceCodeKeymap.set("X", "Extreme");
turbulenceCodeKeymap.set("x", "Extreme");
}

/**
 * Load readable descriptions for Icing codes
 */
function loadIcingCodeKeymap() {
    icingCodeKeymap.set("0", "None");
    icingCodeKeymap.set("1", "Light");
    icingCodeKeymap.set("2", "Light in clouds")
    icingCodeKeymap.set("3", "Light in precipitation")
    icingCodeKeymap.set("4", "Moderate");   
    icingCodeKeymap.set("5", "Moderate in clouds");
    icingCodeKeymap.set("6", "Moderate in precipitation");
    icingCodeKeymap.set("7", "Severe");
    icingCodeKeymap.set("8", "Severe in clouds");
    icingCodeKeymap.set("9", "Severe in precipitation");     
}

/**
 * Map containing standard TAF/Metar acronyms
 */
 function loadSkyConditionmKeymap() {
    skyConditionKeymap.set("BKN", "Broken");
    skyConditionKeymap.set("FM", "From");
    skyConditionKeymap.set("TEMPO", "Temporary");
    skyConditionKeymap.set("BECMG", "Becoming");
    skyConditionKeymap.set("PROB", "Probability");
    skyConditionKeymap.set("CB", "Cumulo-Nimbus");
    skyConditionKeymap.set("IMC", "Instrument meteorological conditions"),
    skyConditionKeymap.set("IMPR", "Improving");
    skyConditionKeymap.set("INC", "In Clouds");
    skyConditionKeymap.set("INS", "Inches");
    skyConditionKeymap.set("INTER", "Intermittent");
    skyConditionKeymap.set("INTSF", "Intensify(ing)");
    skyConditionKeymap.set("INTST", "Intensity");
    skyConditionKeymap.set("JTST", "Jet stream");
    skyConditionKeymap.set("KM", "Kilometers");
    skyConditionKeymap.set("KMH", "Kilometers per hour");
    skyConditionKeymap.set("KT", "Knots");
    skyConditionKeymap.set("L", "Low pressure area");
    skyConditionKeymap.set("LAN", "Land");
    skyConditionKeymap.set("LDA", "Landing distance available");
    skyConditionKeymap.set("LDG", "Landing");
    skyConditionKeymap.set("LGT", "Light");
    skyConditionKeymap.set("LOC", "Locally");
    skyConditionKeymap.set("LSQ", "Line squall");
    skyConditionKeymap.set("LSR", "Loose snow on runway");
    skyConditionKeymap.set("LTG", "Lightning");
    skyConditionKeymap.set("LYR", "Layer");
    skyConditionKeymap.set("M", "Meters");
    skyConditionKeymap.set("M", "Minus or below zero");
    skyConditionKeymap.set("M", "Less than lowest reportable sensor value");
    skyConditionKeymap.set("MAX", "Maximum");
    skyConditionKeymap.set("MB", "Millibars");
    skyConditionKeymap.set("MET", "Meteorological");
    skyConditionKeymap.set("MI", "Shallow");
    skyConditionKeymap.set("MIN", "Minutes");
    skyConditionKeymap.set("MNM", "Minimum");
    skyConditionKeymap.set("MOD", "Moderate");
    skyConditionKeymap.set("MOV", "Move, moving");
    skyConditionKeymap.set("MPS", "Meters per second");
    skyConditionKeymap.set("MS", "Minus");
    skyConditionKeymap.set("MSL", "Mean sea level");
    skyConditionKeymap.set("MTW", "Mountain waves");
    skyConditionKeymap.set("MU", "Runway friction coefficent");
    skyConditionKeymap.set("NC", "No change");
    skyConditionKeymap.set("NIL", "None, nothing");
    skyConditionKeymap.set("NM", "Nautical mile(s)");
    skyConditionKeymap.set("NMRS", "Numerous");
    skyConditionKeymap.set("NO", "Not available");
    skyConditionKeymap.set("NOSIG", "No significant change");
    skyConditionKeymap.set("NS", "Nimbostratus");
    skyConditionKeymap.set("NSC", "No significant clouds");
    skyConditionKeymap.set("NSW", "No Significant Weather");
    skyConditionKeymap.set("OBS", "Observation");
    skyConditionKeymap.set("OBSC", "Obscuring");
    skyConditionKeymap.set("OCNL", "Occasional");
    skyConditionKeymap.set("OKTA", "Eight of sky cover");
    skyConditionKeymap.set("OTP", "On top");
    skyConditionKeymap.set("OTS", "Out of service");
    skyConditionKeymap.set("OVC", "Overcast");
    skyConditionKeymap.set("P", "Greater than highest reportable sensor value");
    skyConditionKeymap.set("P6SM", "Visibility greater than 6 SM");
    skyConditionKeymap.set("PAEW", "Personnel and equipment working");
    skyConditionKeymap.set("PE", "Ice Pellets");
    skyConditionKeymap.set("PJE", "Parachute Jumping Exercise");
    skyConditionKeymap.set("PK WND", "Peak wind");
    skyConditionKeymap.set("PLW", "Plow/plowed");
    skyConditionKeymap.set("PNO", "Precipitation amount not available");
    skyConditionKeymap.set("PO", "Dust/Sand Whirls");
    skyConditionKeymap.set("PPR", "Prior permission required");
    skyConditionKeymap.set("PR", "Partial");
    skyConditionKeymap.set("PRESFR", "Pressure falling rapidly");
    skyConditionKeymap.set("PRESRR", "Pressure rising rapidly");
    skyConditionKeymap.set("PROB", "Probability");
    skyConditionKeymap.set("PROB30", "Probability 30 percent");
    skyConditionKeymap.set("PS", "Plus");
    skyConditionKeymap.set("PSR", "Packed snow on runway");
    skyConditionKeymap.set("PWINO", "Precipitation id sensor not available");
    skyConditionKeymap.set("PY", "Spray");
    skyConditionKeymap.set("R", "Runway (in RVR measurement)");
    skyConditionKeymap.set("RA", "Rain");
    skyConditionKeymap.set("RAB", "Rain Began");
    skyConditionKeymap.set("RADAT", "Radiosonde observation addl data");
    skyConditionKeymap.set("RAE", "Rain Ended");
    skyConditionKeymap.set("RAPID", "Rapid(ly)");
    skyConditionKeymap.set("RASN", "Rain and snow");
    skyConditionKeymap.set("RCAG", "Remote Center Air/Ground Comm Facility");
    skyConditionKeymap.set("RMK", "Remark");
    skyConditionKeymap.set("RVR", "Runway visual range");
    skyConditionKeymap.set("RVRNO", "RVR not available");
    skyConditionKeymap.set("RY/RWY", "Runway");
    skyConditionKeymap.set("SA", "Sand");
    skyConditionKeymap.set("SAND", "Sandstorm");
    skyConditionKeymap.set("SC", "Stratocumulus");
    skyConditionKeymap.set("SCSL", "Stratocumulus standing lenticular cloud");
    skyConditionKeymap.set("SCT", "Scattered cloud coverage");
    skyConditionKeymap.set("SEC", "Seconds");
    skyConditionKeymap.set("SEV", "Severe");
    skyConditionKeymap.set("SFC", "Surface");
    skyConditionKeymap.set("SG", "Snow Grains");
    skyConditionKeymap.set("SH", "Shower");
    skyConditionKeymap.set("SHWR", "Shower");
    skyConditionKeymap.set("SIGMET", "Information from MWO");
    skyConditionKeymap.set("SIR", "Snow and ice on runway");
    skyConditionKeymap.set("SKC", "Sky Clear");
    skyConditionKeymap.set("SLP", "Sea Level Pressure in MB");
    skyConditionKeymap.set("SLPNO", "Sea-level pressure not available");
    skyConditionKeymap.set("SLR", "Slush on runway");
    skyConditionKeymap.set("SLW", "Slow");
    skyConditionKeymap.set("SM", "Statute Miles");
    skyConditionKeymap.set("SMK", "Smoke");
    skyConditionKeymap.set("SMO", "Supplementary meteorological office");
    skyConditionKeymap.set("SN", "Snow");
    skyConditionKeymap.set("SPECI", "Special Report");
    skyConditionKeymap.set("SQ", "Squall");
    skyConditionKeymap.set("SS", "Sandstorm");
    skyConditionKeymap.set("SSR", "Secondary Surveillance Radar");
    skyConditionKeymap.set("T", "Temperature");
    skyConditionKeymap.set("TAF", "Terminal aerodrome forecast in code");
    skyConditionKeymap.set("TAPLEY", "Tapley runway friction coefficient");
    skyConditionKeymap.set("TAR", "Terminal Area Surveillance Radar");
    skyConditionKeymap.set("TAIL", "Tail wind");
    skyConditionKeymap.set("TCH", "Threshold Crossing Height");
    skyConditionKeymap.set("TCU", "Towering Cumulus");
    skyConditionKeymap.set("TDO", "Tornado");
    skyConditionKeymap.set("TDWR", "Terminal Doppler Weather Radar");
    skyConditionKeymap.set("TEMPO", "TEMPO");
    skyConditionKeymap.set("TEND", "Trend or tending to");
    skyConditionKeymap.set("TKOF", "Takeoff");
    skyConditionKeymap.set("TMPA", "Traffic Management Program Alert");
    skyConditionKeymap.set("TODA", "Takeoff distance available");
    skyConditionKeymap.set("TOP", "Cloud top");
    skyConditionKeymap.set("TORA", "Takeoff run available");
    skyConditionKeymap.set("TS", "Thunderstorm");
    skyConditionKeymap.set("TSNO", "Thunderstorm/lightning detector not available");
    skyConditionKeymap.set("TURB", "Turbulence");
    skyConditionKeymap.set("TWY", "Taxiway");
    skyConditionKeymap.set("UFN", "Until further notice");
    skyConditionKeymap.set("UNL", "Unlimited");
    skyConditionKeymap.set("UP", "Unknown Precipitation");
    skyConditionKeymap.set("UTC", "Coordinated Universal Time (=GMT)");
    skyConditionKeymap.set("V", "Variable (wind direction and RVR)");
    skyConditionKeymap.set("VA", "Volcanic Ash");
    skyConditionKeymap.set("VC", "Vicinity");
    skyConditionKeymap.set("VER", "Vertical");
    skyConditionKeymap.set("VFR", "Visual flight rules");
    skyConditionKeymap.set("VGSI", "Visual Glide Slope Indicator");
    skyConditionKeymap.set("VIS", "Visibility");
    skyConditionKeymap.set("VISNO [LOC]", "Visibility Indicator at second location not available");
    skyConditionKeymap.set("VMS", "Visual meteorological conditions");
    skyConditionKeymap.set("VOLMET", "Meteorological information for aircraft in flight");
    skyConditionKeymap.set("VRB", "Variable wind direction");
    skyConditionKeymap.set("VRBL", "Variable");
    skyConditionKeymap.set("VSP", "Vertical speed");
    skyConditionKeymap.set("VV", "Vertical Visibility (indefinite ceiling)");
    skyConditionKeymap.set("WAAS", "Wide Area Augmentation System");
    skyConditionKeymap.set("WDSPR", "Widespread");
    skyConditionKeymap.set("WEF", "With effect from");
    skyConditionKeymap.set("WIE", "With immediate effect");
    skyConditionKeymap.set("WIP", "Work in progress");
    skyConditionKeymap.set("WKN", "Weaken(ing)");
    skyConditionKeymap.set("WR", "Wet runway");
    skyConditionKeymap.set("WS", "Wind shear");
    skyConditionKeymap.set("WSHFT", "Wind shift (in minutes after the hour)");
    skyConditionKeymap.set("WSP", "Weather Systems Processor");
    skyConditionKeymap.set("WSR", "Wet snow on runway");
    skyConditionKeymap.set("WST", "Convective Significant Meteorological Information");
    skyConditionKeymap.set("WTSPT", "Waterspout");
    skyConditionKeymap.set("WW", "Severe Weather Watch Bulletin");
    skyConditionKeymap.set("WX", "Weather");
}