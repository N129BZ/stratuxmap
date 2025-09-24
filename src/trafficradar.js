/**
 * Traffic Radar Module
 * Manages aircraft traffic radar display and collision detection
 */

// Configuration constants
const SOUND_TYPE = {
    BEEP_AND_SPEECH: 0,
    BEEP_ONLY: 1,
    SPEECH_ONLY: 2,
    SOUND_OFF: 3
};

class TrafficRadar {
    constructor(containerId) {
        // Configuration options
        this.soundType = SOUND_TYPE.SOUND_OFF; // Default to sound off
        this.showTraces = true; // Show traces of planes
        this.radarCutoff = 29; // Time in seconds how long a plane is displayed after last packet
        
        // Position and orientation data
        this.lat = 0;
        this.long = 0;
        this.gpsCourse = 0;
        this.oldGpsCourse = 0;
        this.gpsTime = null;
        this.baroAltitude = -100000; // Invalid altitude marker
        this.oldBaroAltitude = 0;
        
        // Display settings
        this.displayRadius = 10; // Radius in NM
        this.oldDisplayRadius = 0;
        this.maxAlarms = 5; // Number of times an alarm sound is played
        this.maxSpeechAlarms = 1; // Number of times aircraft is announced
        this.minimalCircle = 25; // Minimal circle in pixels around center
        this.altDiffThreshold = 20; // In 100 feet
        this.oldAltDiffThreshold = 0;
        
        // Data storage
        this.dataList = []; // Valid position aircraft
        this.dataListInvalid = []; // Invalid position aircraft
        this.situation = {};
        
        // UI and rendering
        this.containerId = containerId;
        this.radar = null;
        this.posAngle = Math.PI; // Global var for angle position of text
        this.synth = null;
        
        // Audio
        this.soundAlert = new Audio('alert.wav');
        
        // Connection status
        this.connectState = 'Disconnected';
        this.rsocket = null;
        this.sitSocket = null;
        
        // Bind methods to maintain context
        this.onMessage = this.onMessage.bind(this);
        this.onSituationMessage = this.onSituationMessage.bind(this);
        this.processTraffic = this.processTraffic.bind(this);
        
        this.init();
    }
    
    init() {
        // Initialize speech synthesis
        this.synth = window.speechSynthesis;
        if (!this.synth) {
            this.soundType = SOUND_TYPE.BEEP_ONLY;
        }
        
        // Initialize radar renderer
        this.initRadarRenderer();
        
        // Set up periodic cleanup
        setInterval(() => this.cleanupOldTraffic(), 1000);
    }
    
    initRadarRenderer() {
        // Create radar display container
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Radar container not found:', this.containerId);
            return;
        }
        
        this.radar = new RadarRenderer(container, this);
    }
    
    // Utility functions
    utcTimeString(epoch) {
        const d = new Date(epoch);
        const hours = d.getUTCHours();
        const minutes = d.getUTCMinutes();
        const seconds = d.getUTCSeconds();
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}Z`;
    }
    
    radiansRel(angle) {
        if (angle > 180) angle = angle - 360;
        if (angle <= -180) angle = angle + 360;
        return angle * Math.PI / 180;
    }
    
    // Speech synthesis
    speakTraffic(altitudeDiff, direction) {
        if (this.soundType === SOUND_TYPE.BEEP_AND_SPEECH || this.soundType === SOUND_TYPE.SPEECH_ONLY) {
            const feet = altitudeDiff * 100;
            const sign = altitudeDiff < 0 ? 'minus' : 'plus';
            let txt = 'Traffic ';
            if (direction) txt += direction + ' o\'clock ';
            txt += sign + ' ' + Math.abs(feet) + ' feet';
            
            const utterance = new SpeechSynthesisUtterance(txt);
            utterance.lang = 'en-US';
            utterance.rate = 1.1;
            this.synth.speak(utterance);
        }
    }
    
    // Process ownship situation data
    onSituationMessage(data) {
        try {
            this.situation = typeof data === 'string' ? JSON.parse(data) : data;
            
            console.log('Traffic radar received situation data:', data);
            
            this.gpsTime = Date.parse(this.situation.GPSTime);
            this.lat = this.situation.GPSLatitude;
            this.long = this.situation.GPSLongitude;
            this.gpsCourse = this.situation.GPSTrueCourse;
            
            console.log('Updated ownship position in radar:', this.lat, this.long, 'Course:', this.gpsCourse);
            
            const pressTime = Date.parse(this.situation.BaroLastMeasurementTime);
            const gpsTime = Date.parse(this.situation.GPSLastGPSTimeStratuxTime);
            
            if (gpsTime - pressTime < 1000) {
                this.baroAltitude = Math.round(this.situation.BaroPressureAltitude);
                console.log('Using barometric altitude:', this.baroAltitude);
            } else {
                const gpsHorizontalAccuracy = this.situation.GPSHorizontalAccuracy;
                if (gpsHorizontalAccuracy > 19999) {
                    this.baroAltitude = -100000; // Invalid
                    console.log('GPS accuracy too low, altitude invalid');
                } else {
                    this.baroAltitude = this.situation.GPSAltitudeMSL;
                    console.log('Using GPS altitude:', this.baroAltitude);
                }
            }
            
            if (this.radar) {
                this.radar.update();
            }
        } catch (error) {
            console.error('Error processing situation message:', error);
        }
    }
    
    // Process traffic message from websocket
    onMessage(message) {
        try {
            const trafficData = typeof message === 'string' ? JSON.parse(message) : message;
            this.processTraffic(trafficData);
        } catch (error) {
            console.error('Error processing traffic message:', error);
        }
    }
    
    // Main traffic processing function
    processTraffic(trafficObject) {
        console.log('Traffic radar processing:', trafficObject);
        
        // Convert from the map.js traffic format to our internal format
        const traffic = this.convertTrafficFormat(trafficObject);
        
        console.log('Converted traffic:', traffic);
        console.log('Current position:', this.lat, this.long, 'Altitude:', this.baroAltitude);
        
        let validIdx = -1;
        let invalidIdx = -1;
        let altDiffValid = false;
        let altDiff = 0;
        
        // Check if we have valid altitude difference
        if (this.baroAltitude > -100000 && traffic.altitude > 0) {
            altDiff = Math.round((traffic.altitude - this.baroAltitude) / 100);
            altDiffValid = true;
        }
        
        console.log('Altitude difference:', altDiff, 'Valid:', altDiffValid);
        
        // Find existing aircraft in valid list
        for (let i = 0; i < this.dataList.length; i++) {
            if (this.dataList[i].icao_int === traffic.icao_int) {
                this.setAircraft(trafficObject, this.dataList[i]);
                if (trafficObject.Position_valid) {
                    this.checkCollisionVectorValid(this.dataList[i]);
                }
                validIdx = i;
                break;
            }
        }
        
        // Find existing aircraft in invalid list
        if (validIdx < 0) {
            for (let i = 0; i < this.dataListInvalid.length; i++) {
                if (this.dataListInvalid[i].icao_int === traffic.icao_int) {
                    this.setAircraft(trafficObject, this.dataListInvalid[i]);
                    if (!trafficObject.Position_valid) {
                        this.checkCollisionVector(this.dataListInvalid[i]);
                    }
                    invalidIdx = i;
                    break;
                }
            }
        }
        
        // Handle new aircraft - Process all aircraft, regardless of altitude filtering for now
        if (validIdx < 0 && trafficObject.Position_valid) {
            console.log('Adding new valid position aircraft:', traffic.icao_int);
            const newTraffic = {};
            this.setAircraft(trafficObject, newTraffic);
            this.checkCollisionVectorValid(newTraffic);
            this.dataList.unshift(newTraffic);
        }
        
        if (invalidIdx < 0 && !trafficObject.Position_valid) {
            console.log('Adding new invalid position aircraft:', traffic.icao_int);
            const newTraffic = {};
            this.setAircraft(trafficObject, newTraffic);
            this.checkCollisionVector(newTraffic);
            this.dataListInvalid.unshift(newTraffic);
        }
        
        // Handle aircraft moving between valid/invalid states
        if (validIdx >= 0 && !trafficObject.Position_valid) {
            this.removeAircraftDisplay(this.dataList[validIdx]);
            this.dataList.splice(validIdx, 1);
        }
        
        if (invalidIdx >= 0 && trafficObject.Position_valid) {
            if (this.dataListInvalid[invalidIdx].circ) {
                this.removeCircularDisplay(this.dataListInvalid[invalidIdx]);
                delete this.dataListInvalid[invalidIdx].posangle;
            }
            this.dataListInvalid.splice(invalidIdx, 1);
        }
    }
    
    // Convert traffic format from map.js to internal format
    convertTrafficFormat(obj) {
        const converted = {
            icao_int: obj.Icao_addr,
            reg: obj.Reg || 'Unknown',
            tail: obj.Tail || obj.Reg || 'Unknown',
            lat: obj.Lat,
            lng: obj.Lng,
            altitude: Math.round(obj.Alt / 25) * 25,
            speed: obj.Speed_valid ? Math.round(obj.Speed / 5) * 5 : 0,
            track: obj.Speed_valid ? Math.round(obj.Track / 5) * 5 : 0,
            vspeed: Math.round(obj.Vvel / 100) * 100,
            distance: obj.Distance,
            bearing: obj.Bearing,
            position_valid: obj.Position_valid,
            timestamp: Date.parse(obj.Timestamp)
        };
        
        console.log('Converted traffic format:', converted);
        return converted;
    }
    
    // Set aircraft data
    setAircraft(obj, aircraft) {
        aircraft.icao_int = obj.Icao_addr;
        aircraft.targettype = obj.TargetType;
        aircraft.timeVal = Date.parse(obj.Timestamp);
        aircraft.time = this.utcTimeString(aircraft.timeVal);
        aircraft.signal = obj.SignalLevel;
        aircraft.distance_estimated = obj.Distance;
        aircraft.lat = obj.Lat;
        aircraft.lon = obj.Lng;
        aircraft.altitude = Math.round(obj.Alt / 25) * 25;
        
        if (obj.Speed_valid) {
            aircraft.nspeed = Math.round(obj.Speed / 5) * 5;
            aircraft.heading = Math.round(obj.Track / 5) * 5;
        } else {
            aircraft.nspeed = '-';
            aircraft.heading = '---';
        }
        
        aircraft.vspeed = Math.round(obj.Vvel / 100) * 100;
        aircraft.tail = obj.Tail || obj.Reg || 'Unknown';
        aircraft.dist = obj.Distance / 1852; // Convert to nautical miles
    }
    
    // Collision detection for aircraft with invalid positions
    checkCollisionVector(traffic) {
        // Implementation for aircraft without valid GPS positions
        // Uses estimated distance and creates circular display
        const distCirc = traffic.distance_estimated / 1852.0;
        let distX = Math.round(200 / this.displayRadius * distCirc);
        
        if (distX < this.minimalCircle) distX = this.minimalCircle;
        
        let altDiff = 0;
        let altDiffValid = 3; // unknown
        
        if (this.baroAltitude > -100000) {
            altDiff = Math.round((traffic.altitude - this.baroAltitude) / 100);
            altDiffValid = 1; // valid difference
        } else {
            altDiffValid = 2; // absolute height
        }
        
        if (traffic.altitude === 0) altDiffValid = 3;
        
        // Remove existing display
        if (traffic.circ) {
            if (traffic.circ.circle && traffic.circ.circle.parentNode) {
                traffic.circ.circle.parentNode.removeChild(traffic.circ.circle);
            }
            if (traffic.circ.altText && traffic.circ.altText.parentNode) {
                traffic.circ.altText.parentNode.removeChild(traffic.circ.altText);
            }
            if (traffic.circ.tailText && traffic.circ.tailText.parentNode) {
                traffic.circ.tailText.parentNode.removeChild(traffic.circ.tailText);
            }
            traffic.circ = null;
        }
        
        // Display if within range and altitude threshold
        if (distX <= 200 && ((altDiffValid === 1 && Math.abs(altDiff) <= this.altDiffThreshold) || altDiffValid === 2)) {
            this.displayCircularTarget(traffic, distX, altDiff, altDiffValid);
            
            // Handle alarms
            if (distCirc <= this.displayRadius / 2) {
                this.handleAlarms(traffic, altDiff, altDiffValid);
            }
        }
    }
    
    // Collision detection for aircraft with valid positions
    checkCollisionVectorValid(traffic) {
        const radiusEarth = 6371008.8; // meters
        
        // Remove existing display
        this.removeAircraftDisplay(traffic);
        
        // Calculate position relative to ownship
        const avgLat = this.radiansRel((this.lat + traffic.lat) / 2);
        const distanceLat = (this.radiansRel(traffic.lat - this.lat) * radiusEarth) / 1852;
        const distanceLng = ((this.radiansRel(traffic.lon - this.long) * radiusEarth) / 1852) * Math.abs(Math.cos(avgLat));
        
        const distX = Math.round(200 / this.displayRadius * distanceLng);
        const distY = -Math.round(200 / this.displayRadius * distanceLat);
        const distRadius = Math.sqrt((distanceLat * distanceLat) + (distanceLng * distanceLng));
        
        // Check altitude difference
        let altDiff = 0;
        if (this.baroAltitude > -100000) {
            altDiff = Math.round((traffic.altitude - this.baroAltitude) / 100);
        } else {
            altDiff = Math.round(traffic.altitude / 100); // Show absolute altitude when no ownship altitude
        }
        
        // For debugging, display all aircraft regardless of altitude difference
        console.log('Processing aircraft with altitude difference:', altDiff, 'threshold:', this.altDiffThreshold);
        
        // Temporarily remove altitude filtering for debugging
        // if (Math.abs(altDiff) > this.altDiffThreshold) {
        //     return; // Outside altitude threshold
        // }
        
        // Display if within radar range
        if (distRadius <= this.displayRadius) {
            this.displayAircraftSymbol(traffic, distX, distY, altDiff);
            
            // Handle alarms and speech
            if (distRadius <= this.displayRadius / 2) {
                this.handleValidPositionAlarms(traffic, distX, distY, altDiff);
            }
        } else {
            // Remove trace when out of range
            if (traffic.trace && traffic.trace.parentNode) {
                traffic.trace.parentNode.removeChild(traffic.trace);
                traffic.trace = null;
            }
            traffic.alarms = 0;
        }
    }
    
    // Display aircraft symbol for valid position aircraft
    displayAircraftSymbol(traffic, distX, distY, altDiff) {
        if (!this.radar || !this.radar.rScreen) {
            console.log('No radar or rScreen available');
            return;
        }
        
        console.log('Displaying aircraft symbol at:', distX, distY, 'for aircraft:', traffic.tail);
        
        const heading = traffic.heading !== '---' ? traffic.heading : 0;
        
        // Create aircraft symbol as a simple triangle (more reliable than complex path)
        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const centerX = this.radar.centerX + distX;
        const centerY = this.radar.centerY + distY;
        
        // Triangle points (pointing up by default)
        const points = `${centerX},${centerY-6} ${centerX-4},${centerY+4} ${centerX+4},${centerY+4}`;
        triangle.setAttribute('points', points);
        triangle.setAttribute('fill', '#ffff00');
        triangle.setAttribute('stroke', '#ffaa00');
        triangle.setAttribute('stroke-width', '1');
        triangle.setAttribute('class', 'radar-aircraft');
        
        // Apply rotation for heading
        if (heading !== 0) {
            triangle.setAttribute('transform', `rotate(${heading} ${centerX} ${centerY})`);
        }
        
        this.radar.rScreen.appendChild(triangle);
        traffic.planeimg = triangle;
        
        // Add text labels
        const sign = altDiff < 0 ? '-' : '+';
        const arrow = traffic.vspeed > 0 ? '↑' : traffic.vspeed < 0 ? '↓' : '';
        const altText = sign + Math.abs(altDiff) + arrow;
        
        // Altitude text
        traffic.planetext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        traffic.planetext.setAttribute('x', centerX + 25);
        traffic.planetext.setAttribute('y', centerY - 8);
        traffic.planetext.setAttribute('fill', '#00ff00');
        traffic.planetext.setAttribute('font-size', '14');
        traffic.planetext.setAttribute('font-family', 'monospace');
        traffic.planetext.setAttribute('class', 'radar-text');
        traffic.planetext.textContent = altText;
        this.radar.rScreen.appendChild(traffic.planetext);
        
        // Speed text
        traffic.planespeed = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        traffic.planespeed.setAttribute('x', centerX + 25);
        traffic.planespeed.setAttribute('y', centerY + 8);
        traffic.planespeed.setAttribute('fill', '#00ff00');
        traffic.planespeed.setAttribute('font-size', '12');
        traffic.planespeed.setAttribute('font-family', 'monospace');
        traffic.planespeed.setAttribute('class', 'radar-text');
        traffic.planespeed.textContent = traffic.nspeed + 'kts';
        this.radar.rScreen.appendChild(traffic.planespeed);
        
        // Tail text
        traffic.planetail = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        traffic.planetail.setAttribute('x', centerX + 25);
        traffic.planetail.setAttribute('y', centerY + 24);
        traffic.planetail.setAttribute('fill', '#ffff00');
        traffic.planetail.setAttribute('font-size', '12');
        traffic.planetail.setAttribute('font-family', 'monospace');
        traffic.planetail.setAttribute('class', 'radar-text');
        traffic.planetail.textContent = traffic.tail;
        this.radar.rScreen.appendChild(traffic.planetail);
        
        console.log('Aircraft symbol displayed successfully');
    }
    
    // Display circular target for invalid position aircraft
    displayCircularTarget(traffic, distX, altDiff, altDiffValid) {
        if (!this.radar || !this.radar.allScreen) {
            console.log('No radar or allScreen available for circular target');
            return;
        }
        
        console.log('Displaying circular target at distance:', distX, 'for aircraft:', traffic.tail);
        
        // Create circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', this.radar.centerX);
        circle.setAttribute('cy', this.radar.centerY);
        circle.setAttribute('r', distX);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#00ff00');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('stroke-dasharray', '5,5');
        circle.setAttribute('class', 'radar-circle');
        this.radar.allScreen.appendChild(circle);
        
        // Set position angle for text
        if (!traffic.posangle) {
            traffic.posangle = this.posAngle;
            this.posAngle += 3 * Math.PI / 16;
            if (this.posAngle > 2 * Math.PI) this.posAngle = Math.PI;
        }
        
        // Create text
        let ctxt = '';
        if (altDiffValid === 1) {
            const sign = altDiff < 0 ? '-' : '+';
            const arrow = traffic.vspeed > 0 ? '↑' : traffic.vspeed < 0 ? '↓' : '';
            ctxt = sign + Math.abs(altDiff) + arrow;
        } else if (altDiffValid === 2) {
            ctxt = traffic.altitude.toString();
        } else {
            ctxt = 'u/s';
        }
        
        const dx = Math.round(distX * Math.cos(traffic.posangle));
        const dy = Math.round(distX * Math.sin(traffic.posangle));
        
        // Add text labels
        const altText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        altText.setAttribute('x', this.radar.centerX + dx);
        altText.setAttribute('y', this.radar.centerY + dy);
        altText.setAttribute('fill', '#00ff00');
        altText.setAttribute('font-size', '14');
        altText.setAttribute('font-family', 'monospace');
        altText.setAttribute('text-anchor', 'middle');
        altText.setAttribute('class', 'radar-text');
        altText.textContent = ctxt;
        this.radar.allScreen.appendChild(altText);
        
        const tailText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tailText.setAttribute('x', this.radar.centerX + dx);
        tailText.setAttribute('y', this.radar.centerY + dy + 18);
        tailText.setAttribute('fill', '#ffff00');
        tailText.setAttribute('font-size', '12');
        tailText.setAttribute('font-family', 'monospace');
        tailText.setAttribute('text-anchor', 'middle');
        tailText.setAttribute('class', 'radar-text');
        tailText.textContent = traffic.tail;
        this.radar.allScreen.appendChild(tailText);
        
        // Store references for cleanup
        traffic.circ = { circle, altText, tailText };
        
        console.log('Circular target displayed successfully');
    }
    
    // Handle alarms for circular targets
    handleAlarms(traffic, altDiff, altDiffValid) {
        if (!traffic.alarms) traffic.alarms = 0;
        
        if (traffic.alarms < this.maxSpeechAlarms && altDiffValid === 1) {
            this.speakTraffic(altDiff, null);
        }
        
        if (traffic.alarms < this.maxAlarms && 
            (this.soundType === SOUND_TYPE.BEEP_AND_SPEECH || this.soundType === SOUND_TYPE.BEEP_ONLY)) {
            this.soundAlert.play();
        }
        
        traffic.alarms++;
    }
    
    // Handle alarms for valid position aircraft
    handleValidPositionAlarms(traffic, distX, distY, altDiff) {
        if (!traffic.alarms) traffic.alarms = 0;
        
        if ((this.soundType === SOUND_TYPE.BEEP_AND_SPEECH || this.soundType === SOUND_TYPE.SPEECH_ONLY) && 
            traffic.alarms < this.maxSpeechAlarms) {
            
            // Calculate o'clock position
            let alpha = 0;
            if (distY >= 0) {
                alpha = Math.PI - Math.atan(distX / distY);
            } else {
                alpha = -Math.atan(distX / distY);
            }
            
            alpha = alpha * 360 / (2 * Math.PI);
            alpha = alpha - this.gpsCourse;
            if (alpha < 0) alpha += 360;
            
            let oclock = Math.round(alpha / 30);
            if (oclock <= 0) oclock += 12;
            
            this.speakTraffic(altDiff, oclock);
        }
        
        if (traffic.alarms < this.maxAlarms && 
            (this.soundType === SOUND_TYPE.BEEP_AND_SPEECH || this.soundType === SOUND_TYPE.BEEP_ONLY)) {
            this.soundAlert.play();
        }
        
        traffic.alarms++;
    }
    
    // Remove aircraft display elements
    removeAircraftDisplay(traffic) {
        if (traffic.planeimg && traffic.planeimg.parentNode) {
            traffic.planeimg.parentNode.removeChild(traffic.planeimg);
            traffic.planeimg = null;
        }
        if (traffic.planetext && traffic.planetext.parentNode) {
            traffic.planetext.parentNode.removeChild(traffic.planetext);
            traffic.planetext = null;
        }
        if (traffic.planetextOut && traffic.planetextOut.parentNode) {
            traffic.planetextOut.parentNode.removeChild(traffic.planetextOut);
            traffic.planetextOut = null;
        }
        if (traffic.planespeed && traffic.planespeed.parentNode) {
            traffic.planespeed.parentNode.removeChild(traffic.planespeed);
            traffic.planespeed = null;
        }
        if (traffic.planetail && traffic.planetail.parentNode) {
            traffic.planetail.parentNode.removeChild(traffic.planetail);
            traffic.planetail = null;
        }
        if (traffic.trace && traffic.trace.parentNode) {
            traffic.trace.parentNode.removeChild(traffic.trace);
            traffic.trace = null;
        }
        if (traffic.circ) {
            this.removeCircularDisplay(traffic);
        }
    }
    
    // Remove circular display elements
    removeCircularDisplay(traffic) {
        if (traffic.circ) {
            if (traffic.circ.circle && traffic.circ.circle.parentNode) {
                traffic.circ.circle.parentNode.removeChild(traffic.circ.circle);
            }
            if (traffic.circ.altText && traffic.circ.altText.parentNode) {
                traffic.circ.altText.parentNode.removeChild(traffic.circ.altText);
            }
            if (traffic.circ.tailText && traffic.circ.tailText.parentNode) {
                traffic.circ.tailText.parentNode.removeChild(traffic.circ.tailText);
            }
            traffic.circ = null;
        }
    }
    
    // Clean up old traffic entries
    cleanupOldTraffic() {
        const now = Date.now();
        const cutoffTime = this.radarCutoff * 1000;
        
        // Clean valid traffic
        this.dataList = this.dataList.filter(traffic => {
            if (now - traffic.timeVal > cutoffTime) {
                this.removeAircraftDisplay(traffic);
                return false;
            }
            return true;
        });
        
        // Clean invalid traffic
        this.dataListInvalid = this.dataListInvalid.filter(traffic => {
            if (now - traffic.timeVal > cutoffTime) {
                if (traffic.circ) {
                    this.removeCircularDisplay(traffic);
                }
                return false;
            }
            return true;
        });
    }
    
    // Public methods for integration with map.js
    updateDisplayRadius(radius) {
        this.displayRadius = radius;
        if (this.radar) {
            this.radar.update();
        }
    }
    
    updateAltitudeThreshold(threshold) {
        this.altDiffThreshold = threshold;
        if (this.radar) {
            this.radar.update();
        }
    }
    
    toggleSound() {
        switch (this.soundType) {
            case SOUND_TYPE.BEEP_AND_SPEECH:
                this.soundType = SOUND_TYPE.BEEP_ONLY;
                break;
            case SOUND_TYPE.BEEP_ONLY:
                this.soundType = this.synth ? SOUND_TYPE.SPEECH_ONLY : SOUND_TYPE.SOUND_OFF;
                break;
            case SOUND_TYPE.SPEECH_ONLY:
                this.soundType = SOUND_TYPE.SOUND_OFF;
                break;
            default:
                this.soundType = SOUND_TYPE.BEEP_AND_SPEECH;
        }
        
        if (this.radar) {
            this.radar.updateSoundStatus();
        }
    }
    
    // Get current status
    getStatus() {
        return {
            connectState: this.connectState,
            displayRadius: this.displayRadius,
            altDiffThreshold: this.altDiffThreshold,
            soundType: this.soundType,
            validTrafficCount: this.dataList.length,
            invalidTrafficCount: this.dataListInvalid.length,
            baroAltitude: this.baroAltitude,
            gpsCourse: this.gpsCourse
        };
    }
}

// RadarRenderer class using native SVG
class RadarRenderer {
    constructor(container, radarInstance) {
        this.container = document.getElementById(container) || container;
        this.radar = radarInstance;
        this.width = 510;
        this.height = 510;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.min(this.width, this.height) / 2 - 40;
        
        this.createSVGDisplay();
    }
    
    createSVGDisplay() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', this.width);
        this.svg.setAttribute('height', this.height);
        this.svg.style.display = 'block';
        
        // Create radar background circles (range rings)
        this.createRangeRings();
        
        // Create center lines (compass lines)
        this.createCompassLines();
        
        // Create center aircraft symbol
        this.createCenterAircraft();
        
        // Create groups for different elements
        this.allScreen = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.allScreen.setAttribute('id', 'all-screen');
        this.svg.appendChild(this.allScreen);
        
        this.rScreen = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.rScreen.setAttribute('id', 'r-screen');
        this.svg.appendChild(this.rScreen);
        
        this.container.appendChild(this.svg);
        
        // Mock screen objects for compatibility
        this.allScreen.group = () => this.createGroup(this.allScreen);
        this.rScreen.group = () => this.createGroup(this.rScreen);
        this.allScreen.circle = (r) => this.createCircle(r, this.allScreen);
        this.allScreen.text = (text) => this.createText(text, this.allScreen);
        this.rScreen.path = (d) => this.createPath(d, this.rScreen);
        this.rScreen.text = (text) => this.createText(text, this.rScreen);
        this.rScreen.circle = (r) => this.createCircle(r, this.rScreen);
        this.rScreen.polyline = (points) => this.createPolyline(points, this.rScreen);
    }
    
    createGroup(parent) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        parent.appendChild(g);
        
        return {
            add: (element) => {
                if (element.element) {
                    g.appendChild(element.element);
                }
            },
            remove: () => ({
                forget: () => {
                    if (g.parentNode) {
                        g.parentNode.removeChild(g);
                    }
                }
            })
        };
    }
    
    createCircle(radius, parent) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#00ff00');
        circle.setAttribute('stroke-width', '1');
        
        return {
            element: circle,
            cx: (x) => {
                circle.setAttribute('cx', x + this.centerX);
                return this;
            },
            cy: (y) => {
                circle.setAttribute('cy', y + this.centerY);
                return this;
            },
            addClass: (className) => {
                circle.setAttribute('class', className);
                return this;
            },
            remove: () => ({
                forget: () => {
                    if (circle.parentNode) {
                        circle.parentNode.removeChild(circle);
                    }
                }
            })
        };
    }
    
    createText(text, parent) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.setAttribute('fill', '#00ff00');
        textElement.setAttribute('font-size', '10');
        textElement.setAttribute('font-family', 'monospace');
        textElement.setAttribute('text-anchor', 'middle');
        
        return {
            element: textElement,
            move: (x, y) => {
                textElement.setAttribute('x', x + this.centerX);
                textElement.setAttribute('y', y + this.centerY);
                return this;
            },
            center: (x, y) => {
                textElement.setAttribute('x', x + this.centerX);
                textElement.setAttribute('y', y + this.centerY);
                return this;
            },
            rotate: (angle, cx, cy) => {
                textElement.setAttribute('transform', `rotate(${angle} ${cx + this.centerX} ${cy + this.centerY})`);
                return this;
            },
            addClass: (className) => {
                textElement.setAttribute('class', className);
                return this;
            },
            remove: () => ({
                forget: () => {
                    if (textElement.parentNode) {
                        textElement.parentNode.removeChild(textElement);
                    }
                }
            })
        };
    }
    
    createPath(pathData, parent) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', '#ffff00');
        path.setAttribute('stroke', '#ffff00');
        path.setAttribute('stroke-width', '1');
        
        return {
            element: path,
            addClass: (className) => {
                path.setAttribute('class', className);
                return this;
            },
            size: (w, h) => {
                // For aircraft symbol scaling
                return this;
            },
            center: (x, y) => {
                path.setAttribute('transform', `translate(${x + this.centerX - 15}, ${y + this.centerY - 15})`);
                return this;
            },
            remove: () => ({
                forget: () => {
                    if (path.parentNode) {
                        path.parentNode.removeChild(path);
                    }
                }
            })
        };
    }
    
    createPolyline(points, parent) {
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        const adjustedPoints = points.map(p => `${p[0] + this.centerX},${p[1] + this.centerY}`).join(' ');
        polyline.setAttribute('points', adjustedPoints);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', '#00aa00');
        polyline.setAttribute('stroke-width', '1');
        
        return {
            element: polyline,
            addClass: (className) => {
                polyline.setAttribute('class', className);
                return this;
            },
            attr: (name, value) => {
                if (name === 'points') {
                    const newPoints = value.split(' ').map(p => {
                        const coords = p.split(',');
                        return `${parseFloat(coords[0]) + this.centerX},${parseFloat(coords[1]) + this.centerY}`;
                    }).join(' ');
                    polyline.setAttribute('points', newPoints);
                } else {
                    polyline.setAttribute(name, value);
                }
                return value;
            },
            remove: () => ({
                forget: () => {
                    if (polyline.parentNode) {
                        polyline.parentNode.removeChild(polyline);
                    }
                }
            })
        };
    }
    
    createRangeRings() {
        const rings = [0.25, 0.5, 0.75, 1.0]; // Fractional distances for range rings
        
        rings.forEach(fraction => {
            const radius = this.maxRadius * fraction;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', this.centerX);
            circle.setAttribute('cy', this.centerY);
            circle.setAttribute('r', radius);
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', '#006600');
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('opacity', '0.7');
            this.svg.appendChild(circle);
            
            // Add range labels
            if (fraction === 1.0) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', this.centerX);
                label.setAttribute('y', this.centerY - radius - 5);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('fill', '#00aa00');
                label.setAttribute('font-size', '10');
                label.setAttribute('font-family', 'monospace');
                label.textContent = this.radar.displayRadius + ' NM';
                this.svg.appendChild(label);
            }
        });
    }
    
    createCompassLines() {
        // Create cardinal direction lines
        const directions = [0, 45, 90, 135, 180, 225, 270, 315]; // degrees
        
        directions.forEach(angle => {
            const radians = (angle - 90) * Math.PI / 180; // -90 to make 0° point up
            const x1 = this.centerX + Math.cos(radians) * (this.maxRadius * 0.15);
            const y1 = this.centerY + Math.sin(radians) * (this.maxRadius * 0.15);
            const x2 = this.centerX + Math.cos(radians) * this.maxRadius;
            const y2 = this.centerY + Math.sin(radians) * this.maxRadius;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#004400');
            line.setAttribute('stroke-width', angle % 90 === 0 ? '1.5' : '0.5');
            line.setAttribute('opacity', '0.6');
            this.svg.appendChild(line);
        });
    }
    
    createCenterAircraft() {
        // Create center aircraft symbol (triangle pointing up)
        const aircraft = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        aircraft.setAttribute('points', `${this.centerX},${this.centerY-8} ${this.centerX-6},${this.centerY+4} ${this.centerX+6},${this.centerY+4}`);
        aircraft.setAttribute('fill', '#ffff00');
        aircraft.setAttribute('stroke', '#ffaa00');
        aircraft.setAttribute('stroke-width', '1');
        this.svg.appendChild(aircraft);
        
        // Add "OWN" label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', this.centerX);
        label.setAttribute('y', this.centerY + 20);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#ffff00');
        label.setAttribute('font-size', '8');
        label.setAttribute('font-family', 'monospace');
        label.textContent = 'OWN';
        this.svg.appendChild(label);
    }
    
    update() {
        // Recreate range rings with current radius
        this.createSVGDisplay();
        console.log('Radar display updated');
    }
    
    updateSoundStatus() {
        console.log('Sound status updated');
    }
}

// ES6 Module exports
export { TrafficRadar, SOUND_TYPE };
export default TrafficRadar;