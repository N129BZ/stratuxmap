import { stateCache } from './map.js';
import { toLonLat } from 'ol/proj.js';

export async function saveMapState(view) {
    try {
        await view;
        const internalCenter = view.getCenter();
        if (internalCenter) {
            // Transform coordinates from EPSG:3857 (Web Mercator) to EPSG:4326 (Lat/Lon)
            stateCache.viewposition = toLonLat(internalCenter, view.getProjection());
        }     
        
        // Serialize messages Map to array
        let messagesArray = [];
        if (stateCache.messages && stateCache.messages.map && typeof stateCache.messages.map.forEach === 'function') {
            stateCache.messages.map.forEach((message, key) => {
                messagesArray.push({ key, message });
            });
        }
        const now = Math.floor(Date.now() / 1000); // seconds since epoch
        const stateToSave = {
            ...stateCache,
            messages: messagesArray
        };

        await fetch('/savemapstate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateToSave)
        });
    }
    catch(err){
        console.log("saveMapState Error:", err);
    }
}

export async function restoreMapState() {
    try {
        const res = await fetch('/getmapstate');
        const restoredState = await res.json();
        if (!restoredState) {
            console.log("No restored state found!");
            return;
        }
        else {
            console.log("Restoring map state:", restoredState);
        }
        const detail = {
                zoom: restoredState.zoom,
                viewposition: restoredState.viewposition,
                rotation: restoredState.rotation,
                layervisibility: restoredState.layervisibility,
                selectedRadius: restoredState.selectedRadius,
                messages: []
        };
        const replayEvent = new CustomEvent('stateReplay', { detail });
        window.dispatchEvent(replayEvent);
    } 
    catch (err) {
        console.log("restoreMapState Error:", err);
    }
}
