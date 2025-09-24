/**
 * Aviation Navaid Symbology Generator
 * Generates SVG symbols for different types of navigation aids based on ICAO standards
 * and FAA chart symbology conventions.
 */

/**
 * Fetch navaid data from server with optional bounding box constraint
 * @param {Object} boundingBox - Optional bounding box {minLat, maxLat, minLon, maxLon}
 * @returns {Promise<Array>} Array of navaid objects
 */
async function fetchNavaidData(boundingBox = null) {
    try {
        let url = '/navaids';
        
        if (boundingBox) {
            const { minLat, maxLat, minLon, maxLon } = boundingBox;
            url = `/navaids?minLat=${minLat}&maxLat=${maxLat}&minLon=${minLon}&maxLon=${maxLon}`;
            console.log(`Fetching navaid data with bounding box: minLat=${minLat}, maxLat=${maxLat}, minLon=${minLon}, maxLon=${maxLon}`);
        } else {
            console.log('Fetching all navaid data from server...');
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const navaids = await response.json();
        console.log(`Received ${navaids ? navaids.length : 0} navaids from server`);
        
        return navaids || [];
    } catch (error) {
        console.error('Error fetching navaid data:', error);
        return [];
    }
}

/**
 * Calculate bounding box for a given center point and radius
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude  
 * @param {number} radiusMiles - Radius in miles
 * @returns {Object} Bounding box {minLat, maxLat, minLon, maxLon}
 */
function getBoundingBox(centerLat, centerLon, radiusMiles) {
    // Convert miles to degrees (approximate)
    const latDegreePerMile = 1 / 69.0;
    const lonDegreePerMile = 1 / (69.0 * Math.cos(centerLat * Math.PI / 180));
    
    const latRadius = radiusMiles * latDegreePerMile;
    const lonRadius = radiusMiles * lonDegreePerMile;
    
    return {
        minLat: centerLat - latRadius,
        maxLat: centerLat + latRadius,
        minLon: centerLon - lonRadius,
        maxLon: centerLon + lonRadius
    };
}

// Standard navaid symbol colors following ICAO/FAA conventions
const NAVAID_COLORS = {
    VOR: '#8B4513',        // Brown for VOR
    VOR_DME: '#8B4513',    // Brown for VOR-DME
    VORTAC: '#8B4513',     // Brown for VORTAC
    NDB: '#8B4513',        // Brown for NDB
    DME: '#8B4513',        // Brown for DME
    TACAN: '#0000FF',      // Blue for military TACAN
    ILS: '#8B4513',        // Brown for ILS
    LOC: '#8B4513',        // Brown for Localizer
    GPS: '#8B4513',        // Brown for GPS waypoints
    WAYPOINT: '#8B4513'    // Brown for waypoints
};

// Standard symbol sizes
const SYMBOL_SIZES = {
    SMALL: 18,
    MEDIUM: 22,
    LARGE: 26
};

/**
 * Generate VOR symbol - hexagon with center dot
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate  
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createVORSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const radius = size / 2;
    const hexPoints = [];
    
    // Generate hexagon points
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * Math.PI / 180; // Start from top
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        hexPoints.push(`${px},${py}`);
    }
    
    return `
        <g class="vor-symbol" data-type="VOR" data-id="${identifier}">
            <polygon points="${hexPoints.join(' ')}" 
                     fill="none" 
                     stroke="${NAVAID_COLORS.VOR}" 
                     stroke-width="2"/>
            <circle cx="${x}" cy="${y}" r="2" 
                    fill="${NAVAID_COLORS.VOR}"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate VOR-DME symbol - hexagon with center dot and small square
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createVORDMESymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const radius = size / 2;
    const hexPoints = [];
    
    // Generate hexagon points
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * Math.PI / 180;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        hexPoints.push(`${px},${py}`);
    }
    
    const dmeSize = size * 0.3;
    
    return `
        <g class="vor-dme-symbol" data-type="VOR-DME" data-id="${identifier}">
            <polygon points="${hexPoints.join(' ')}" 
                     fill="none" 
                     stroke="${NAVAID_COLORS.VOR_DME}" 
                     stroke-width="2"/>
            <circle cx="${x}" cy="${y}" r="2" 
                    fill="${NAVAID_COLORS.VOR_DME}"/>
            <rect x="${x + radius + 2}" y="${y - dmeSize/2}" 
                  width="${dmeSize}" height="${dmeSize}" 
                  fill="none" 
                  stroke="${NAVAID_COLORS.VOR_DME}" 
                  stroke-width="1"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate VORTAC symbol - hexagon with center dot and triangle
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createVORTACSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const radius = size / 2;
    const hexPoints = [];
    
    // Generate hexagon points
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * Math.PI / 180;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        hexPoints.push(`${px},${py}`);
    }
    
    // Triangle for TACAN component
    const triSize = size * 0.25;
    const triX = x + radius + 4;
    const triY = y;
    const triPoints = [
        `${triX},${triY - triSize}`,
        `${triX + triSize},${triY + triSize/2}`,
        `${triX - triSize},${triY + triSize/2}`
    ];
    
    return `
        <g class="vortac-symbol" data-type="VORTAC" data-id="${identifier}">
            <polygon points="${hexPoints.join(' ')}" 
                     fill="none" 
                     stroke="${NAVAID_COLORS.VORTAC}" 
                     stroke-width="2"/>
            <circle cx="${x}" cy="${y}" r="2" 
                    fill="${NAVAID_COLORS.VORTAC}"/>
            <polygon points="${triPoints.join(' ')}" 
                     fill="none" 
                     stroke="${NAVAID_COLORS.VORTAC}" 
                     stroke-width="1"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate NDB symbol - circle with center dot and dashes
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createNDBSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const radius = size / 2;
    
    return `
        <g class="ndb-symbol" data-type="NDB" data-id="${identifier}">
            <circle cx="${x}" cy="${y}" r="${radius}" 
                    fill="none" 
                    stroke="${NAVAID_COLORS.NDB}" 
                    stroke-width="2" 
                    stroke-dasharray="3,2"/>
            <circle cx="${x}" cy="${y}" r="2" 
                    fill="${NAVAID_COLORS.NDB}"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate DME symbol - square
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createDMESymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const halfSize = size / 2;
    
    return `
        <g class="dme-symbol" data-type="DME" data-id="${identifier}">
            <rect x="${x - halfSize}" y="${y - halfSize}" 
                  width="${size}" height="${size}" 
                  fill="none" 
                  stroke="${NAVAID_COLORS.DME}" 
                  stroke-width="2"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate TACAN symbol - triangle (military)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @returns {string} SVG string
 */
function createTACANSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '') {
    const halfSize = size / 2;
    const triPoints = [
        `${x},${y - halfSize}`,
        `${x + halfSize},${y + halfSize}`,
        `${x - halfSize},${y + halfSize}`
    ];
    
    return `
        <g class="tacan-symbol" data-type="TACAN" data-id="${identifier}">
            <polygon points="${triPoints.join(' ')}" 
                     fill="none" 
                     stroke="${NAVAID_COLORS.TACAN}" 
                     stroke-width="2"/>
            <circle cx="${x}" cy="${y}" r="2" 
                    fill="${NAVAID_COLORS.TACAN}"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate ILS symbol - runway with feather pattern
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @param {number} runway - Runway heading
 * @returns {string} SVG string
 */
function createILSSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '', runway = 0) {
    const length = size;
    const width = size * 0.3;
    
    // Rotate runway to match heading
    const angle = runway * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Runway endpoints
    const x1 = x - (length/2) * cos;
    const y1 = y - (length/2) * sin;
    const x2 = x + (length/2) * cos;
    const y2 = y + (length/2) * sin;
    
    // Feather lines (approach pattern)
    const featherLines = [];
    for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * size/6;
        const fx1 = x1 - offset * sin;
        const fy1 = y1 + offset * cos;
        const fx2 = x1 - (offset + size/3) * sin;
        const fy2 = y1 + (offset + size/3) * cos;
        featherLines.push(`<line x1="${fx1}" y1="${fy1}" x2="${fx2}" y2="${fy2}" stroke="${NAVAID_COLORS.ILS}" stroke-width="1"/>`);
    }
    
    return `
        <g class="ils-symbol" data-type="ILS" data-id="${identifier}">
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                  stroke="${NAVAID_COLORS.ILS}" stroke-width="3"/>
            ${featherLines.join('')}
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate GPS waypoint symbol - triangle
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Waypoint identifier
 * @returns {string} SVG string
 */
function createGPSWaypointSymbol(x, y, size = SYMBOL_SIZES.SMALL, identifier = '') {
    const halfSize = size / 2;
    const triPoints = [
        `${x},${y - halfSize}`,
        `${x + halfSize * 0.866},${y + halfSize/2}`,
        `${x - halfSize * 0.866},${y + halfSize/2}`
    ];
    
    return `
        <g class="gps-waypoint-symbol" data-type="GPS" data-id="${identifier}">
            <polygon points="${triPoints.join(' ')}" 
                     fill="${NAVAID_COLORS.GPS}" 
                     stroke="none"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Generate Localizer symbol - single feather line
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @param {string} identifier - Station identifier
 * @param {number} runway - Runway heading
 * @returns {string} SVG string
 */
function createLocalizerSymbol(x, y, size = SYMBOL_SIZES.MEDIUM, identifier = '', runway = 0) {
    const length = size;
    
    // Rotate to match runway heading
    const angle = runway * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const x1 = x - (length/2) * cos;
    const y1 = y - (length/2) * sin;
    const x2 = x + (length/2) * cos;
    const y2 = y + (length/2) * sin;
    
    // Single feather line
    const fx1 = x1 - size/4 * sin;
    const fy1 = y1 + size/4 * cos;
    const fx2 = x1 - size/2 * sin;
    const fy2 = y1 + size/2 * cos;
    
    return `
        <g class="localizer-symbol" data-type="LOC" data-id="${identifier}">
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                  stroke="${NAVAID_COLORS.LOC}" stroke-width="2"/>
            <line x1="${fx1}" y1="${fy1}" x2="${fx2}" y2="${fy2}" 
                  stroke="${NAVAID_COLORS.LOC}" stroke-width="1"/>
            ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                  text-anchor="middle" 
                                  font-family="B612" 
                                  font-size="12" 
                                  fill="#000000">${identifier}</text>` : ''}
        </g>`;
}

/**
 * Main function to generate navaid symbol based on type
 * @param {Object} navaid - Navaid data object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Symbol size
 * @returns {string} SVG string
 */
function generateNavaidSymbol(navaid, x, y, size = SYMBOL_SIZES.MEDIUM) {
    const type = navaid.type ? navaid.type.toUpperCase() : 'UNKNOWN';
    const identifier = navaid.ident || navaid.name || '';
    const runway = navaid.runway_heading || 0;
    
    switch (type) {
        case 'VOR':
            return createVORSymbol(x, y, size, identifier);
        case 'VOR-DME':
        case 'VOR/DME':
            return createVORDMESymbol(x, y, size, identifier);
        case 'VORTAC':
            return createVORTACSymbol(x, y, size, identifier);
        case 'NDB':
        case 'NDBDME':
            return createNDBSymbol(x, y, size, identifier);
        case 'DME':
            return createDMESymbol(x, y, size, identifier);
        case 'TACAN':
            return createTACANSymbol(x, y, size, identifier);
        case 'ILS':
        case 'ILS-DME':
            return createILSSymbol(x, y, size, identifier, runway);
        case 'LOC':
        case 'LOCALIZER':
            return createLocalizerSymbol(x, y, size, identifier, runway);
        case 'GPS':
        case 'WAYPOINT':
            return createGPSWaypointSymbol(x, y, SYMBOL_SIZES.SMALL, identifier);
        default:
            // Generic circle for unknown types
            return `
                <g class="unknown-navaid-symbol" data-type="${type}" data-id="${identifier}">
                    <circle cx="${x}" cy="${y}" r="${size/2}" 
                            fill="none" 
                            stroke="#666666" 
                            stroke-width="1"/>
                    <circle cx="${x}" cy="${y}" r="2" 
                            fill="#666666"/>
                    ${identifier ? `<text x="${x}" y="${y + size/2 + 12}" 
                                          text-anchor="middle" 
                                          font-family="B612" 
                                          font-size="12" 
                                          fill="#000000">${identifier}</text>` : ''}
                </g>`;
    }
}

/**
 * Generate complete navaid layer with multiple navaids
 * @param {Array} navaids - Array of navaid objects
 * @param {Function} coordinateConverter - Function to convert lat/lon to screen coordinates
 * @returns {string} Complete SVG string for all navaids
 */
function generateNavaidLayer(navaids, coordinateConverter) {
    const symbols = navaids.map(navaid => {
        if (!navaid.latitude || !navaid.longitude) return '';
        
        const [x, y] = coordinateConverter(navaid.longitude, navaid.latitude);
        return generateNavaidSymbol(navaid, x, y);
    }).filter(symbol => symbol !== '');
    
    return `
        <g class="navaid-layer">
            ${symbols.join('\n')}
        </g>`;
}

/**
 * Database field mapping for common navaid database schemas
 */
const NAVAID_FIELD_MAPPING = {
    // Common field names that might be found in navaid databases
    type: ['type', 'navaid_type', 'facility_type', 'nav_type'],
    identifier: ['ident', 'identifier', 'id', 'facility_id', 'navaid_id'],
    name: ['name', 'facility_name', 'navaid_name', 'description'],
    latitude: ['latitude', 'lat', 'latitude_deg'],
    longitude: ['longitude', 'lon', 'lng', 'longitude_deg'],
    frequency: ['frequency', 'freq', 'frequency_khz', 'frequency_mhz'],
    elevation: ['elevation', 'elev', 'elevation_ft'],
    runway_heading: ['runway_heading', 'runway_hdg', 'localizer_heading', 'course']
};

/**
 * Normalize navaid data from database to standard format
 * @param {Object} rawNavaid - Raw navaid data from database
 * @returns {Object} Normalized navaid object
 */
function normalizeNavaidData(rawNavaid) {
    const normalized = {};
    
    // Map fields using the field mapping
    Object.keys(NAVAID_FIELD_MAPPING).forEach(standardField => {
        const possibleFields = NAVAID_FIELD_MAPPING[standardField];
        for (const field of possibleFields) {
            if (rawNavaid[field] !== undefined && rawNavaid[field] !== null) {
                normalized[standardField] = rawNavaid[field];
                break;
            }
        }
    });
    
    return normalized;
}

// ES6 module exports for Vite/modern bundlers
export {
    fetchNavaidData,
    getBoundingBox,
    generateNavaidSymbol,
    generateNavaidLayer,
    normalizeNavaidData,
    createVORSymbol,
    createVORDMESymbol,
    createVORTACSymbol,
    createNDBSymbol,
    createDMESymbol,
    createTACANSymbol,
    createILSSymbol,
    createGPSWaypointSymbol,
    createLocalizerSymbol,
    NAVAID_COLORS,
    SYMBOL_SIZES,
    NAVAID_FIELD_MAPPING
};

// Legacy exports for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        fetchNavaidData,
        getBoundingBox,
        generateNavaidSymbol,
        generateNavaidLayer,
        normalizeNavaidData,
        createVORSymbol,
        createVORDMESymbol,
        createVORTACSymbol,
        createNDBSymbol,
        createDMESymbol,
        createTACANSymbol,
        createILSSymbol,
        createGPSWaypointSymbol,
        createLocalizerSymbol,
        NAVAID_COLORS,
        SYMBOL_SIZES,
        NAVAID_FIELD_MAPPING
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window object
    window.NavaidSymbols = {
        fetchNavaidData,
        getBoundingBox,
        generateNavaidSymbol,
        generateNavaidLayer,
        normalizeNavaidData,
        createVORSymbol,
        createVORDMESymbol,
        createVORTACSymbol,
        createNDBSymbol,
        createDMESymbol,
        createTACANSymbol,
        createILSSymbol,
        createGPSWaypointSymbol,
        createLocalizerSymbol,
        NAVAID_COLORS,
        SYMBOL_SIZES,
        NAVAID_FIELD_MAPPING
    };
}
