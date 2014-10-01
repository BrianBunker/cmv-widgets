define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',

    'dojo/on',

    'esri/graphic',

    'esri/renderers/SimpleRenderer',

    'esri/symbols/PictureMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',

    'esri/layers/GraphicsLayer',

    'esri/graphicsUtils',

    'esri/geometry/Extent'
], function(
    declare, lang, array,
    on,
    Graphic,
    SimpleRenderer,
    PictureMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
    GraphicsLayer,
    graphicsUtils,
    Extent
) {

    return declare([], {

        // Spatial Reference. uses the map's spatial reference if none provided
        spatialReference: null,

        // Use 0.001 for decimal degrees (wkid 4326)
        // or 5000 for meters/feet
        pointExtentSize: null,

        // default symbology for found features
        symbols: {
            point: {
                type: 'esriPMS',
                height: 25,
                width: 25,
                url: '',
                contentType: 'image/png',
                imageData: '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'
            },
            polyline: {
                type: 'esriSLS',
                style: 'esriSLSSolid',
                color: [0, 255, 255, 255],
                width: 3
            },
            polygon: {
                type: 'esriSFS',
                style: 'esriSFSSolid',
                color: [0, 255, 255, 32],
                outline: {
                    type: 'esriSLS',
                    style: 'esriSLSSolid',
                    color: [0, 255, 255, 255],
                    width: 3
                }
            }
        },

        postCreate: function() {
            // build the selection layers
            this.createSelectionLayers();
        },

        createSelectionLayers: function() {
            if (this.spatialReference === null) {
                this.spatialReference = this.map.spatialReference.wkid;
            }
            if (this.pointExtentSize === null) {
                // sr: factor
                this.pointExtentSize = {
                    102100: 5000,
                    4326: 0.001
                };
            }
            this.createPointResultLayer();
            this.createPolylineResultLayer();
            this.createPolygonResultLayer();
        },
        createPointResultLayer: function() {
            // points
            this.pointGraphics = new GraphicsLayer({
                id: this.baseClass + '_point',
                title: 'Graphics'
            });
            on(this.pointGraphics, 'click', lang.hitch(this, function(evt) {
                evt.preventDefault();
                evt.stopPropagation();
                delete evt.graphic; //remove the reference to the graphic so it can be identified
                this.map.emit('click', evt);
            }));

            if (this.symbols.point) {
                var pointSymbol = new PictureMarkerSymbol(this.symbols.point);
                var pointRenderer = new SimpleRenderer(pointSymbol);
                pointRenderer.label = this.baseClass + 'Results (Points)';
                pointRenderer.description = this.baseClass + 'results (Points)';
                this.pointGraphics.setRenderer(pointRenderer);
            }
            this.map.addLayer(this.pointGraphics);
        },
        createPolylineResultLayer: function() {
            // poly line
            this.polylineGraphics = new GraphicsLayer({
                id: this.baseClass + '_line',
                title: this.baseClass + 'Graphics'
            });

            if (this.symbols.polyline) {
                var polylineSymbol = new SimpleLineSymbol(this.symbols.polyline);
                var polylineRenderer = new SimpleRenderer(polylineSymbol);
                polylineRenderer.label = this.baseClass + 'Results (Lines)';
                polylineRenderer.description = this.baseClass + 'Results (Lines)';
                this.polylineGraphics.setRenderer(polylineRenderer);
            }
            this.map.addLayer(this.polylineGraphics);
        },
        createPolygonResultLayer: function() {
            // polygons
            this.polygonGraphics = new GraphicsLayer({
                id: this.baseClass + '_polygon',
                title: this.baseClass + 'Graphics'
            });

            if (this.symbols.polygon) {
                var polygonSymbol = new SimpleFillSymbol(this.symbols.polygon);
                var polygonRenderer = new SimpleRenderer(polygonSymbol);
                polygonRenderer.label = this.baseClass + 'Results (Polygons)';
                polygonRenderer.description = this.baseClass + 'Results (Polygons)';
                this.polygonGraphics.setRenderer(polygonRenderer);
            }
            this.map.addLayer(this.polygonGraphics);
        },

        highlightFeatures: function(results, geometryForExtent) {
            var uniqueId = 0;
            array.forEach(results, function(result) {
                // add a uniqueId key for the store
                result.id = uniqueId;
                uniqueId++;
                var graphic;
                switch (result.geometry.type) {
                    case 'point':
                        graphic = new Graphic(result.geometry);
                        this.pointGraphics.add(graphic);
                        break;
                    case 'polyline':
                        graphic = new Graphic(result.geometry);
                        this.polylineGraphics.add(graphic);
                        break;
                    case 'polygon':
                        graphic = new Graphic(result.geometry, null, {
                            ren: 1
                        });
                        this.polygonGraphics.add(graphic);
                        break;
                    default:
                }
            }, this);

            // zoom to layer extent
            var zoomExtent = null;
            //If the layer is a single point then extents are null
            // if there are no features in the layer then extents are null
            // the result of union() to null extents is null
            if (geometryForExtent && geometryForExtent.getExtent) {
                zoomExtent = geometryForExtent.getExtent();
            } else {
                if (this.pointGraphics.graphics.length > 0) {
                    zoomExtent = this.getPointFeaturesExtent(this.pointGraphics.graphics);
                }
                if (this.polylineGraphics.graphics.length > 0) {
                    if (zoomExtent === null) {
                        zoomExtent = graphicsUtils.graphicsExtent(this.polylineGraphics.graphics);
                    } else {
                        zoomExtent = zoomExtent.union(graphicsUtils.graphicsExtent(this.polylineGraphics.graphics));
                    }
                }
                if (this.polygonGraphics.graphics.length > 0) {
                    if (zoomExtent === null) {
                        zoomExtent = graphicsUtils.graphicsExtent(this.polygonGraphics.graphics);
                    } else {
                        zoomExtent = zoomExtent.union(graphicsUtils.graphicsExtent(this.polygonGraphics.graphics));
                    }
                }
            }

            this.zoomToExtent(zoomExtent);
        },

        zoomToExtent: function(extent) {
            this.map.setExtent(extent.expand(1.2), true);
        },

        clearSelectionGraphics: function() {
            this.pointGraphics.clear();
            this.polylineGraphics.clear();
            this.polygonGraphics.clear();
        },

        getPointFeaturesExtent: function(pointFeatures) {
            var extent = graphicsUtils.graphicsExtent(pointFeatures);
            if (extent === null && pointFeatures.length > 0) {
                extent = this.getExtentFromPoint(pointFeatures[0]);
            }

            return extent;
        },

        getExtentFromPoint: function(point) {
            var pt = point.geometry;
            var sz = this.pointExtentSize[pt.spatialReference.wkid]; // hack
            var extent = new Extent({
                'xmin': pt.x - sz,
                'ymin': pt.y - sz,
                'xmax': pt.x + sz,
                'ymax': pt.y + sz,
                'spatialReference': pt.spatialReference
            });
            return extent;
        }
    });
});