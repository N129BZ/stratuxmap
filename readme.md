# Add aviation charts to the Stratux map with Dynamic METARs/SPECIs, WINDS, TAFs, Pireps, Position History, Ownship Tracking (moving map) - Using OpenLayers map API  

## EXPERIMENTAL USE ONLY!  USE AT YOUR OWN RISK!

Key Functionality:
Moving Map & Navigation.

Map Engine: Uses OpenLayers to display aviation charts and base maps.

Offline Tiles: Supports offline tile databases (OSM, Sectional, Terminal) via a local tile server.

Ownship Tracking: Displays the user's aircraft position, heading, and altitude in real-time using WebSocket data from Stratux (/situation).

State Persistence: Saves and restores map view (zoom, center, rotation), layer visibility, and radar settings when the app is closed or backgrounded.

Weather & Information Overlays:
  METARs & TAFs: Visualizes weather reports and forecasts with color-coded flight categories (VFR, MVFR, IFR, LIFR). Clicking a station shows a detailed popup with decoded weather data.
  PIREPs: Displays pilot reports for turbulence, icing, and other conditions.
  Airports: Shows airports with symbols indicating type (towered, uncontrolled, heliport, seaplane) and status (closed). Popups provide frequencies and runway details (including surface type decoding).
  Radius Search: Allows searching for airports within a specific radius (10, 25, 50, 100 NM) of a point.

Traffic Radar & Collision Avoidance:

Visual Radar: A dedicated "Radar Scope" overlay visualizes nearby traffic relative to your position.
  Traffic Targets: Displays aircraft as triangles (with heading) or circles (if position is estimated). Shows relative altitude, vertical speed, and tail number.

Collision Alerts: Calculates collision risks based on distance and altitude difference.
  Audio Alerts: Provides spoken alerts (e.g., "Traffic 2 o'clock minus 500 feet") and beep sounds. Supports multiple sound modes (Beep+Speech, Beep Only, etc.).

Technical Implementation:
  Frontend: Built with Vite and Vanilla JavaScript (no heavy framework like React/Vue).
  Real-time Data: Uses WebSockets to consume data from Stratux endpoints:
    /traffic: ADS-B traffic updates.
    /situation: Ownship GPS/AHRS data.
    /weather: FIS-B weather data.

Architecture: Modular design with separate files for map logic (map.js), radar (trafficradar.js), and data parsing (stratuxconversion.js).

This application effectively turns a device connected to Stratux into a feature-rich Electronic Flight Bag (EFB) companion.


