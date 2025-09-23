

import { stateCache, FIFOCache } from './map.js';


export async function saveMapState() {
    try {
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
            messages: messagesArray,
            timestamp: now
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
        const now = Math.floor(Date.now() / 1000);
        const maxAgeMinutes = 10; // set your desired age limit here
        let detail = {};
        if (restoredState.timestamp && (now - restoredState.timestamp) <= maxAgeMinutes * 60) {
            // State is recent, use all
            detail = restoredState;
        } else {
            // State is too old, only restore position/zoom/rotation
            detail = {
                zoom: restoredState.zoom,
                viewposition: restoredState.viewposition,
                rotation: restoredState.rotation,
                layervisibility: restoredState.layervisibility,
                selectedRadius: restoredState.selectedRadius,
                messages: []
            };
        }
        const replayEvent = new CustomEvent('stateReplay', { detail });
        window.dispatchEvent(replayEvent);
    } 
    catch (err) {
        console.log("restoreMapState Error:", err);
    }
}
