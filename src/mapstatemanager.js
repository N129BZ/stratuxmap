

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
            return null;
        }
        const replayEvent = new CustomEvent('stateReplay', { detail: restoredState });
        window.dispatchEvent(replayEvent);
        return restoredState;
    } 
    catch (err) {
        console.log("restoreMapState Error:", err);
        return null;
    }
}

export async function getMapState(raiseRestoreEvent) {
    try {
        const res = await fetch('/getmapstate');
        const restoredState = await res.json();
        if (!restoredState) {
            return null;
        }
        else if (raiseRestoreEvent) {
            const replayEvent = new CustomEvent('stateReplay', { detail: restoredState });
            window.dispatchEvent(replayEvent);
        }
        return restoredState;
    } 
    catch (err) {
        console.log("getMapState Error:", err);
        return null;
    }
}