import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';

const pirepLayer = new ImageLayer({
  source: new ImageCanvasSource({
    canvasFunction: function(extent, resolution, pixelRatio, size, projection) {
      const canvas = document.createElement('canvas');
      canvas.width = size[0];
      canvas.height = size[1];
      const context = canvas.getContext('2d');
      // Draw custom graphics here
      context.fillStyle = 'rgba(255,0,0,0.5)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
    },
    projection: 'EPSG:3857'
  }),
  title: 'Pireps'
});

export default pirepLayer;