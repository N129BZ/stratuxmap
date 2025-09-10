

import { stateCache, FIFOCache } from './map.js';


export function saveMapState() {
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
        console.log("SAVING MAP STATE");
        fetch('/savemapstate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateToSave)
        });
    }
    catch(err){
        console.log("saveMapState Error:", err);
    }
}

export function restoreMapState() {
    try {
        fetch('/getmapstate')
            .then(res => res.json())
            .then(restoredState => {
                if(!restoredState) return;
                const replayEvent = new CustomEvent('stateReplay', { detail: restoredState });
                window.dispatchEvent(replayEvent);
        });
            
    }
    catch(err) {
        console.log("restoreMapState Error:", err);
    }
}