/**
 * Map of weather abbriviation to SVG data and Full text
 */
let WEATHER = {
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

const CONDITIONS = {
    VFR: "green",
    MVFR: "blue",
    IFR: "red",
    LIFR: "purple"
};

export { WEATHER, CLOUDS, CONDITIONS }

var BRK_DWN_ARW = "<line class=\"wx_graphic\" x1=\"350\" y1=\"50\" x2=\"175\" y2=\"250\"></line>\n    <line class=\"wx_graphic\" x1=\"170\" y1=\"245\" x2=\"350\" y2=\"415\"></line>\n    <line class=\"wx_graphic\" x1=\"350\" y1=\"415\" x2=\"250\" y2=\"415\"></line>\n    <line class=\"wx_graphic\" x1=\"350\" y1=\"425\" x2=\"350\" y2=\"315\"></line>";
var RIGHT_ARROW = "<line class=\"wx_graphic\" x1=\"120\" y1=\"250\" x2=\"430\" y2=\"250\"></line>\n    <line class=\"wx_graphic\" x1=\"380\" y1=\"250\" x2=\"465\" y2=\"250\" transform=\"rotate(-45, 450, 250)\"></line>\n    <line class=\"wx_graphic\" x1=\"380\" y1=\"250\" x2=\"450\" y2=\"250\" transform=\"rotate(45, 450, 250)\"></line>";
var TRANSFORM = "transform=\"matrix(1.4,0,0,1.2,-102.2,-30.3)\"";
var DWN_TRI = "<polygon style=\"stroke: black\" points=\"150 160 350 160 250 475\"></polygon>";

var size = 25;
var piD = (size / 2) * 3.14 * 2;
var CLR_SQUARE = "<g id=\"clr\">\n        <rect width=\"" + size + "\" height=\"" + size + "\" x=\"calc(250 - " + size / 2 + ")\" y=\"calc(250 - " + size / 2 + ")\" class=\"coverage\"/>\n    </g>";
var CLR_CIRCLE = "<g id=\"clr\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    </g>";
var FEW = "<g id=\"few\">\n        <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n        <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n        stroke-dasharray=\"0 calc(75 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n        class=\"partial\"/>\n    </g>";
var SCT = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(25 * " + piD + " / 100) calc(50 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
var BRK = "<g id=\"few\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" fill=\"#00000000\" class=\"coverage\"/>\n    <circle cx=\"250\" cy=\"250\" r=\"" + size / 2 + "\" fill=\"#00000000\" \n    stroke-dasharray=\"calc(49 * " + piD + " / 100) calc(26 * " + piD + " / 100) calc(25 * " + piD + " / 100)\"\n    class=\"partial\"/>\n</g>";
var OVC = "<g id=\"ovc\">\n    <circle cx=\"250\" cy=\"250\" r=\"" + size + "\" class=\"ovc\"/>\n</g>";


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