

export async function saveMapState(metarVectorLayer, tafVectorLayer, 
                                   pirepVectorLayer, trafficVectorLayer,
                                   osmTileLayer, map) {
    const serializeFeature = (f) => {
        const style = f.getStyle();
        let styleProps = {};
        if (style && style.getImage && style.getImage()) {
            const img = style.getImage();
            styleProps = {
                src: img.getSrc && img.getSrc(),
                scale: img.getScale && img.getScale(),
                offset: img.getOffset && img.getOffset(),
                opacity: img.getOpacity && img.getOpacity()
            };
        }
        return {
            geometry: f.getGeometry().getCoordinates(),
            properties: f.getProperties(),
            style: styleProps
        };
    };

    const metarFeatures = metarVectorLayer.getSource().getFeatures().map(serializeFeature);
    const tafFeatures = tafVectorLayer.getSource().getFeatures().map(serializeFeature);
    const pirepFeatures = pireVectorpLayer.getSource().getFeatures().map(serializeFeature);

    const view = map.getView();
    mapState = {
        pirepVisible: pirepVectorLayer.getVisible(),
        metarVisible: metarVectorLayer.getVisible(),
        tafVisible: tafVectorLayer.getVisible(),
        trafficVisible: trafficVectorLayer.getVisible(),
        osmVisible: osmTileLayer.getVisible(),
        center: view.getCenter(),
        zoom: view.getZoom(),
        rotation: view.getRotation(),
        metarFeatures: metarFeatures,
        tafFeatures: tafFeatures,
        pirepFeatures: pirepFeatures
    };
    localStorage.setItem('mapState', JSON.stringify(mapState));
}

export async function restoreMapState(metarVectorLayer, tafVectorLayer, 
                                      pirepVectorLayer, trafficVectorLayer,
                                      osmTileLayer, map) {
    const saved = localStorage.getItem('mapState');
    if (saved) {
        try {
            const mapState = JSON.parse(saved);
            // Layer visibility
            if (mapState.pirepVisible) pirepVectorLayer.setVisible(mapState.pirepVisible);
            if (mapState.metarVisible) metarVectorLayer.setVisible(mapState.metarVisible);
            if (mapState.tafVisible) tafVectorLayer.setVisible(mapState.tafVisible);
            if (mapState.trafficVisible) trafficVectorLayer.setVisible(mapState.trafficVisible);
            if (mapState.osmVisible) osmTileLayer.setVisible(mapState.osmVisible);
            // Map view
            if (mapState.center.length === 2) map.getView().setCenter(mapState.center);
            if (typeof mapState.zoom === "number") map.getView().setZoom(mapState.zoom);
            if (typeof mapState.rotation === "number") map.getView().setRotation(mapState.rotation);
            
            const restoreFeature = (f, layer) => {
                const { geometry, ...props } = f.properties || {};
                const feature = new Feature({
                    geometry: new Point(f.geometry),
                    ...props
                });
                if (f.style && f.style.src) {
                    feature.setStyle(new Style({
                        image: new Icon({
                            src: f.style.src,
                            scale: f.style.scale,
                            offset: f.style.offset,
                            opacity: f.style.opacity
                        })
                    }));
                }
                layer.getSource().addFeature(feature);
            };

            if (Array.isArray(mapState.metarFeatures)) {
                metarVectorLayer.getSource().clear();
                mapState.metarFeatures.forEach(f => restoreFeature(f, metarVectorLayer));
            }
            if (Array.isArray(mapState.tafFeatures)) {
                tafVectorLayer.getSource().clear();
                mapState.tafFeatures.forEach(f => restoreFeature(f, tafVectorLayer));
            }
            if (Array.isArray(mapState.pirepFeatures)) {
                pirepVectorLayer.getSource().clear();
                mapState.pirepFeatures.forEach(f => restoreFeature(f, pirepVectorLayer));
            }
        } catch (err) {
            console.log("RESTORE ERROR:", err)
        }
    }    
}