

export function saveMapState() {
    const metarFeatures = metarVectorLayer.getSource().getFeatures().map(f => {
        return {
            geometry: f.getGeometry().getCoordinates(),
            properties: f.getProperties()
        };
    });

    const tafFeatures = tafVectorLayer.getSource().getFeatures().map(f => {
        return {
            geometry: f.getGeometry().getCoordinates(),
            properties: f.getProperties()
        };
    });

    const pirepFeatures = pirepVectorLayer.getSource().getFeatures().map(f => {
        return {
            geometry: f.getGeometry().getCoordinates(),
            properties: f.getProperties()
        }
    });

    const view = map.getView();
    mapState = {
        pirep: pirepVectorLayer.getVisible(),
        metar: metarVectorLayer.getVisible(),
        taf: tafVectorLayer.getVisible(),
        traffic: trafficVectorLayer.getVisible(),
        osm: osmTileLayer.getVisible(),
        center: view.getCenter(),
        zoom: view.getZoom(),
        rotation: view.getRotation(),
        metarFeatures: metarFeatures,
        tafFeatures: tafFeatures,
        pirepFeatures: pirepFeatures
    };
    localStorage.setItem('mapState', JSON.stringify(mapState));
}

export function restoreMapState() {
    const saved = localStorage.getItem('mapState');
    if (saved) {
        try {
            const mapState = JSON.parse(saved);
            // Layer visibility
            if (typeof mapState.pirep === "boolean") pirepVectorLayer.setVisible(mapState.pirep);
            if (typeof mapState.metar === "boolean") metarVectorLayer.setVisible(mapState.metar);
            if (typeof mapState.taf === "boolean") tafVectorLayer.setVisible(mapState.taf);
            if (typeof mapState.traffic === "boolean") trafficVectorLayer.setVisible(mapState.traffic);
            if (typeof mapState.osm === "boolean") osmTileLayer.setVisible(mapState.osm);
            // Map view
            if (Array.isArray(mapState.center) && mapState.center.length === 2) map.getView().setCenter(mapState.center);
            if (typeof mapState.zoom === "number") map.getView().setZoom(mapState.zoom);
            if (typeof mapState.rotation === "number") map.getView().setRotation(mapState.rotation);
            
            if (Array.isArray(mapState.metarFeatures)) {
                //metarVectorLayer.getSource().clear();
                mapState.metarFeatures.forEach(f => {
                    const { geometry, ...props } = f.properties || {};
                    const feature = new Feature({
                        geometry: new Point(f.geometry),
                        ...props
                    });
                    metarVectorLayer.getSource().addFeature(feature);
                });
            }

            if (Array.isArray(mapState.tafFeatures)) {
                //tafVectorLayer.getSource().clear();
                mapState.tafFeatures.forEach(f => {
                    const { geometry, ...props } = f.properties || {};
                    const feature = new Feature({
                        geometry: new Point(f.geometry),
                        ...props
                    });
                    tafVectorLayer.getSource().addFeature(feature);
                });
            }
            
            if (Array.isArray(mapState.pirepFeatures)) {
                //pirepVectorLayer.getSource().clear();
                mapState.pirepFeatures.forEach(f => {
                    const { geometry, ...props } = f.properties || {};
                    const feature = new Feature({
                        geometry: new Point(f.geometry),
                        ...props
                    });
                    pirepVectorLayer.getSource().addFeature(feature);
                });
            }
        } catch (err) {
            console.log("RESTORE ERROR:", err)
        }
    }    
}