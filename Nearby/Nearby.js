define([
    // basics
    'require',

    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',

    'put-selector',

    // mixins & base classes
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    './_SelectionLayersMixin',

    // mapping & geo!
    'esri/config',
    'esri/graphic',
    'esri/units',
    'esri/request',

    'esri/layers/FeatureLayer',

    'esri/tasks/query',
    'esri/tasks/GeometryService',
    'esri/tasks/DistanceParameters',

    'esri/toolbars/draw',

    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/PictureMarkerSymbol',

    'esri/geometry/Point',
    'esri/geometry/Circle',
    'esri/geometry/Polygon',
    'esri/geometry/Polyline',
    'esri/geometry/geodesicUtils',
    'esri/geometry/webMercatorUtils',

    // async
    'dojo/on',
    'dojo/Deferred',
    'dojo/promise/all',

    // grid
    'dojo/store/Memory',

    'dgrid/OnDemandGrid',
    'dgrid/Selection',
    'dgrid/Keyboard',

    'dijit/Dialog',

    'dojo/window',

    // templates & widget css
    'dojo/text!./Nearby/templates/Nearby.html',
    'xstyle/css!./Nearby/css/Nearby.css',

    // not referenced
    'dijit/form/RadioButton',
    'dijit/form/Button',
    'dijit/form/NumberTextBox',
    'dijit/form/Select',

    'dojo/NodeList-dom'
], function(
    require,
    declare, lang, array,
    put,
    _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
    _SelectionLayersMixin,
    esriConfig, Graphic, Units, request,
    FeatureLayer,
    QueryTask, GeometryService, DistanceParameters,
    Draw,
    SimpleFillSymbol, SimpleLineSymbol, PictureMarkerSymbol,
    Point, Circle, Polygon, Polyline, geodesicUtils, webMercatorUtils,
    on, Deferred, all,
    Memory,
    OnDemandGrid, Selection, Keyboard,
    Dialog, win,
    template, css
) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, _SelectionLayersMixin], {
        widgetsInTemplate: true,
        templateString: template,
        baseClass: 'gis_NearbyDijit',

        postCreate: function() {
            this.inherited(arguments);

            this.nearbyMode = 'distance';
            this.featureSelectionLayer = null;
            this.gridPosition = 'floating'; // or 'docked'
            // this.gridPosition = 'docked'; // or 'floating'
            this.gridNode = put('div'); // object to hold grid HTMLObject

            this.initUI();
            this.geometryService = esriConfig.defaults.geometryService;
        },

        initUI: function() {
            this.initDrawTool();
            this.setupConnections();
            this.populateLayerSelect();
            // this.createResultsGrid();
        },

        populateLayerSelect: function() {
            var options = [];
            array.forEach(this.map.layerIds, lang.hitch(this, function(layerId, i) {
                if (i !== 0) {
                    if (this.map.getLayer(layerId).layerInfos && this.map.getLayer(layerId).layerInfos.length > 0) {
                        array.forEach(this.map.getLayer(layerId).layerInfos, lang.hitch(this, function(layerInfo, j) {
                            options.unshift({
                                value: layerId + ':' + j,
                                label: layerInfo.name
                            });
                        }));
                    } else if (this.map.getLayer(layerId).name) {
                        options.unshift({
                            value: layerId + ':',
                            label: this.map.getLayer(layerId).name
                        });
                    }
                }
            }));
            this.nearbyFeaturesSelect.addOption(options);
            this.setupSelectionLayers(this.nearbyFeaturesSelect.get('value'));
        },

        initDrawTool: function() {
            this.drawTool = new Draw(this.map);
        },

        setupConnections: function() {
            this.map.graphics.on('click', lang.hitch(this, 'preventMapGraphicsClickStop'));
            this.nearbyModeDistance.on('change', lang.hitch(this, 'toggleDistanceOptions'));
            this.nearbyModeDriveTime.on('change', lang.hitch(this, 'toggleDriveTimeOptions'));
            this.nearbyFeaturesSelect.on('change', lang.hitch(this, 'setupSelectionLayers'));
            this.nearbyModeDistance_options.on('change', lang.hitch(this, 'updateNearby'));
            this.dropPointButton.on('click', lang.hitch(this, 'activateMapPointDrop'));
            this.clearDropButton.on('click', lang.hitch(this, 'clearResults'));
            this.drawTool.on('draw-complete', lang.hitch(this, 'handleDrawEnd'));
        },

        preventMapGraphicsClickStop: function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            delete evt.graphic; //remove the reference to the graphic so it can be identified
            this.map.emit('click', evt);
        },

        toggleDistanceOptions: function(radioSelected) {
            if (radioSelected) {
                put(this.nearbyModeDistanceSpan, '!off');
                this.nearbyMode = 'distance';
            } else {
                put(this.nearbyModeDistanceSpan, '.off');
            }
        },

        toggleDriveTimeOptions: function(radioSelected) {
            if (radioSelected) {
                put(this.nearbyModeDriveTime_label, '!off');
                this.nearbyMode = 'drivetime';
            } else {
                put(this.nearbyModeDriveTime_label, '.off');
            }
        },

        setupSelectionLayers: function(layerIdAndIndex) {
            this.clearSelectionLayer();
            delete this.featureSelectionLayer;
            this.featureSelectionLayer = null;
            var layerUrlParts = layerIdAndIndex.split(':');
            var layerId = layerUrlParts[0];
            var index = layerUrlParts[1];
            var urlIndex = (!!index && index !== '') ? '/' + index : '';
            this.featureSelectionLayer = new FeatureLayer(this.map.getLayer(layerId).url + urlIndex, {
                mode: FeatureLayer.SELECTION,
                outFields: ['*'],
                id: 'nearbySelectionLayer'
            });

            this.updateNearbyFeatures();
        },

        clearSelectionLayer: function() {
            if (this.featureSelectionLayer) {
                this.featureSelectionLayer.clear();
                this.featureSelectionLayer.clearSelection();
            }
        },

        activateMapPointDrop: function(evt) {
            this.mapClickMode.current = 'draw';
            this.clearResults();
            this.dropPointButton.set('label', 'Waiting for point drop');
            this.dropPointButton.set('disabled', true);
            this.drawTool.activate(Draw.POINT);
        },

        handleDrawEnd: function(evt) {
            this.mapClickMode.current = this.mapClickMode.defaultMode;
            this.droppedPoint = evt;
            this.drawTool.deactivate();
            this.showPoint(this.droppedPoint.geometry);
            this.dropPointButton.set('label', 'Change point location');
            this.dropPointButton.set('disabled', false);
            put(this.clearDropButton.domNode, '!off');

            // do the analysis
            this.doNearbyAnalysis();
        },

        showPoint: function(geometry) {
            this.clearMapPointDrop();
            var point = new Point(geometry.toJson());
            var pictureMarkerSymbol = new PictureMarkerSymbol(this.getPointSymbolInfo());
            this.pointGraphic = new Graphic(point, pictureMarkerSymbol);

            this.map.graphics.add(this.pointGraphic);
        },

        getPointSymbolInfo: function() {
            return {
                'type': 'esriPMS',
                'url': '',
                'imageData': 'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDozODQzQzc1OTNFOUIxMUUzQTg5MkJGRUVDQUQxNkU3RSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDozODQzQzc1QTNFOUIxMUUzQTg5MkJGRUVDQUQxNkU3RSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkY2REQ1M0IyM0U5ODExRTNBODkyQkZFRUNBRDE2RTdFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjM4NDNDNzU4M0U5QjExRTNBODkyQkZFRUNBRDE2RTdFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+3zhYuAAAA29JREFUeNrMmM9rE1EQx2fTbH71R1Laiq3U9iCi4I8WQRA8tBRPCu3Ri6AeBL0U8e9Qbx70YEFpe/FH0SJYSouKglYrtoJUD40hadMkNmnapPmxqTP1rTy3+zbZTYoZ+LKbfbzdz87Mm50XaWtrC6rJbFBlVnVAkvZCe9+NATz0ozpRPTpzplGLqLHA5M2n5TxcL10kDchtR31zp8u3F2S3F/B8x4RsMgq5dAI248t0TmDXrYIJgRDmouzx3vd2dAMedSen4hGQJAlsNXaQUHaHC5TMBiT8s5BLJS4h1FBFgBCmx1YjT7UcPYMPk4WTCUhrdqcbwZwQmZuAgpLrRajpcoEoqQcb2o8Ywogsn0mDkssBzaf7VGqVDTh9rZZvkM+kgM0fqNiyt+Id3u3lzN+RBqKBercdzp/eB2dP7IHWRheEYikYe+eHB5M/IJnK7Vodsotg7lw5Bgfbav9ea2vywNVzh6H3eBtcvvXKCEoSOdNypSbP8DC8HWr3woW+A6L7uVEeTvTbhXKiHMwBNtNAFCYj6z/VIRpqRHmZGsjZqDpULQdIcLLIk7oho5wxMgqfwJpZaEgFpjxKYUeKcxaVYWNKSUBLq5uGUJTgAmvhHqSFyTOYFAPeLDlk4x9XDD1Eq01gar6oOaOeu5hqmSRRkusCjb4JwkJoQ/eJ3wKJ7aUvMAeTrCN1DJh3CiXnUDKdh2t3v1ipQzJ7SRsXKhsngkiKwmVYGAnq3oR/W6KPaxEgPbBVpoJpIIumB6SKcoDeKm3p02HRHIJQURL/QsWKVezd9JDCwVHehFj9gf8FxCdyiHkHqgFoCRVgntp9IOqzNTnE50+G7VDiZhq0z/HFWcswzjof0Hwlsx7WFEB62SDKb7TM9YB607GfpqFUmLXAHKwHv66EPwyPairzOmqBHUtvYXGnEDcL9S/MfDQ8M/xEySQLHAzF8TvLHfM9tRkoHiYZnI+FZ0aeY7gKXLiiqMeoqVKWuWG7iXs0H93I3bS/y9fZrbtR5GFWZkaeIUxW7UpQL1CfSl1RhlvpYlDpRFQEE2Eg71kDVpm9fTGogpLXwlB9eYl6yxqvyv7ZUAyKcusPzOhDTOBxHHtt1EZUHIiHqnF4unIbMX9k9tFgNhmeYG1o2Sba2wtNXX1KNjWUXVs+iTBjlYIR2W8BBgB+dqgi6ZiY/wAAAABJRU5ErkJggg==',
                'contentType': 'image/png',
                'width': 23,
                'height': 23,
                'xoffset': 7,
                'yoffset': 11
            };
        },

        getPolygonSymbolInfo: function() {
            return {
                'type': 'esriSFS',
                'style': 'esriSFSSolid',
                'color': [70, 70, 70, 40],
                'outline': {
                    'type': 'esriSLS',
                    'style': 'esriSLSSolid',
                    'color': [0, 0, 0, 40],
                    'width': 1
                }
            };
        },

        clearMapPointDrop: function(evt) {
            if (this.pointGraphic) {
                this.map.graphics.remove(this.pointGraphic);
                this.pointGraphic = null;
                delete this.pointGraphic;
            }
        },

        clearNearbyArea: function(evt) {
            if (this.nearbyAreaGraphic) {
                this.map.graphics.remove(this.nearbyAreaGraphic);
                this.nearbyAreaGraphic = null;
                delete this.nearbyAreaGraphic;
            }
        },

        updateNearby: function(evt) {
            this.clearSelectionLayer();
            this.clearSelectionGraphics();
            this.clearResultsGrid();

            if (this.pointGraphic) {
                this.doNearbyAnalysis();
            }
        },

        doNearbyAnalysis: function() {
            // which mode is selected? distance or drive time
            // get a geodesic circle or a drivetime polygon
            this.nearbyArea = null;
            if (this.nearbyMode === 'distance') {
                // what is the distance radius value?
                this.nearbyArea = new Circle({
                    center: this.pointGraphic.geometry,
                    geodesic: true,
                    radius: this.nearbyValueInput.get('value'),
                    radiusUnit: Units[this.nearbyModeDistance_options.get('value')]
                });
                this.selectNearbyFeatures();
                this.nearbyResultsNode.innerHTML = '';
            } else if (this.nearbyMode === 'drivetime') {
                // what is the drivetime radius value?
                this.drivetimeUI(true);
                request({
                    url: 'http://sampleserver3.arcgisonline.com/ArcGIS/rest/services/Network/USA/NAServer/Service%20Area/solveServiceArea',
                    content: {
                        facilities: '{"features": [{"geometry": ' + JSON.stringify(this.pointGraphic.geometry.toJson()) + '}]}',
                        defaultBreaks: this.nearbyValueInput.get('value'),
                        f: 'json'
                    },
                    handleAs: 'json',
                    callbackParamName: 'callback'
                }).then(lang.hitch(this, function(result) {
                    this.drivetimeUI(false);
                    this.nearbyArea = new Polygon(result.saPolygons.features[0].geometry);
                    this.selectNearbyFeatures();
                }), lang.hitch(this, function(err) {
                    this.drivetimeUI(false);
                    this.nearbyResultsNode.innerHTML = 'Sorry, couldn\'t get drive time area. Try a shorter time or a location near a road. If the problem persists, the service might be down temporarily.';
                }));
            }
        },

        drivetimeUI: function(on) {
            if (on) {
                var spinnerUrl = require.toUrl('./Nearby/images/loading.gif');
                var spinnerNode = put('img.loading[src=' + spinnerUrl + ']');
                this.nearbyResultsNode.innerHTML = spinnerNode.outerHTML + 'Calculating drive time area';
            } else {
                this.nearbyResultsNode.innerHTML = '';
            }
        },

        selectNearbyFeatures: function() {
            this.showNearbyArea();
            // which features are targeted?
            //this.featureSelectionLayer
            // get features intersecting this.nearbyArea
            var q = new QueryTask();
            q.geometry = this.nearbyArea;
            this.featureSelectionLayer.selectFeatures(q, FeatureLayer.SELECTION_NEW).then(lang.hitch(this, function(selectionResults) {
                this.selectionResults = selectionResults;
                this.highlightFeatures(selectionResults, this.nearbyArea);
                this.createResultsGrid();
            }));
        },

        updateNearbyFeatures: function() {
            if (this.nearbyArea) {
                this.clearSelectionLayer();
                this.clearSelectionGraphics();
                this.selectNearbyFeatures();
            }
        },

        showNearbyArea: function() {
            this.clearNearbyArea();
            var nearbyAreaSymbol = new SimpleFillSymbol(this.getPolygonSymbolInfo());
            this.nearbyAreaGraphic = new Graphic(this.nearbyArea, nearbyAreaSymbol);
            this.map.graphics.add(this.nearbyAreaGraphic);
        },

        createResultsGrid: function() {
            if (this.selectionResults && this.selectionResults.length > 0) {
                // mixin distance and only return attributes
                var results = array.map(this.selectionResults, lang.hitch(this, 'addDistanceToResult'));

                all(results).then(lang.hitch(this, function(distanceAddResults) {
                    var columnInfo = this.getColumnInfo(distanceAddResults);

                    if (!this.resultsStore) {
                        this.resultsStore = new Memory({
                            idProperty: 'id',
                            data: distanceAddResults
                        });
                    }
                    if (!this.gridDialog) {
                        this.gridDialog = new Dialog({
                            title: 'Nearby Results',
                            'class': 'nearbyNonModal',
                            id: 'nearbyGridDialog',
                            closable: false
                        });
                        var viewport = win.getBox();
                        var posX = viewport.w - 625;
                        var posY = viewport.h - 400;
                        this.gridDialog._relativePosition = {
                            x: posX > 0 ? posX : 0,
                            y: posY > 0 ? posY : 0
                        };
                        this.gridDialog.focus = function() {}; // kill the default focus function
                        // include a dock button on the modal
                        this.dockButton = put(this.gridDialog.closeButtonNode, '+span.dockButton');
                        on(this.dockButton, 'click', lang.hitch(this, 'dockResultsGrid'));
                    }
                    if (this.gridPosition === 'floating') {
                        this.gridDialog.show();
                    } else if (this.gridPosition === 'docked') {
                        this.gridDialog.hide();
                    }

                    if (!this.resultsGrid) {
                        this.resultsGrid = new(declare([OnDemandGrid, Keyboard, Selection]))({
                            selectionMode: 'single',
                            cellNavigation: false,
                            showHeader: true,
                            store: this.resultsStore,
                            columns: columnInfo,
                            sort: [{
                                attribute: '__distance',
                                descending: false
                            }]
                            //minRowsPerPage: 250,
                            //maxRowsPerPage: 500
                        }, this.gridNode);
                        this.resultsGrid.startup();
                        this.resultsGrid.on('.dgrid-cell:click', lang.hitch(this, 'selectFeature'));
                    } else {
                        this.resultsGrid.set('columns', columnInfo);
                        this.resultsStore.setData(distanceAddResults);
                        this.resultsGrid.refresh();
                    }
                    if (this.gridPosition === 'docked') {
                        put(this.nearbyResultsGrid, this.gridNode);
                        put(this.nearbyResultsGrid, '!off');
                    } else if (this.gridPosition === 'floating') {
                        if (this.gridDialog.get('content') === '') {
                            this.gridDialog.set('content', this.resultsGrid);
                        }
                        put(this.nearbyResultsGrid, '.off');
                    }
                    this.resultsGrid.refresh();
                }));
            } else {
                put(this.nearbyResultsGrid, '.off');
                if (this.gridDialog) {
                    this.gridDialog.hide();
                }
                this.nearbyResultsNode.innerHTML = 'No features were found nearby. Please try another location or layer.';
            }
        },

        addDistanceToResult: function(result) {
            var df = new Deferred();
            var dp = new DistanceParameters();
            var selectedUnit = this.nearbyModeDistance_options.get('value');
            if (selectedUnit === 'MILES') {
                selectedUnit = 'STATUTE_MILE';
            } else if (selectedUnit === 'KILOMETERS') {
                selectedUnit = 'KILOMETER';
            }
            dp.distanceUnit = GeometryService['UNIT_' + selectedUnit];
            dp.geodesic = true;
            dp.geometry1 = result.geometry;
            dp.geometry2 = new Point(this.droppedPoint.geometry);
            if (dp.geometry1.spatialReference.wkid !== dp.geometry2.spatialReference.wkid) {
                if (dp.geometry1.spatialReference.wkid !== 4326) {
                    dp.geometry2 = webMercatorUtils.webMercatorToGeographic(dp.geometry2);
                }
                if (dp.geometry2.spatialReference.wkid !== 4326) {
                    dp.geometry2 = webMercatorUtils.webMercatorToGeographic(dp.geometry2);
                }
            }
            this.geometryService.distance(dp).then(lang.hitch(this, 'distanceSuccess', df, result), lang.hitch(this, 'distanceFailure', df, result));
            return df;
        },
        distanceSuccess: function(df, result, distanceResult) {
            df.resolve(
                lang.mixin({}, {
                    '__distance': parseFloat(distanceResult.toFixed(3)),
                    'id': result.id
                }, result.attributes)
            );
        },
        distanceFailure: function(df, result, err) {
            df.resolve(
                lang.mixin({}, {
                    '__distance': 0.0,
                    'id': result.id
                }, result.attributes)
            );
        },

        dockResultsGrid: function(evt) {
            this.gridPosition = 'docked';
            this.createResultsGrid();
        },

        undockResultsGrid: function(evt) {
            this.gridPosition = 'floating';
            this.createResultsGrid();
        },

        getColumnInfo: function(results) {
            var columnInfo = {};
            for (var columnName in results[0]) {
                if (results[0].hasOwnProperty(columnName)) {
                    if (columnName === '__distance') {
                        columnInfo.__distance = {
                            label: 'Distance (' + this.nearbyModeDistance_options.get('value').toLowerCase() + ')',
                            formatter: lang.hitch(this, 'numberWithCommas')
                        };
                    } else if (columnName !== 'id') {
                        columnInfo[columnName] = columnName;
                    }
                }
            }
            return columnInfo;
        },

        // from http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
        numberWithCommas: function(value) {
            var parts = value.toString().split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.join('.');
        },

        selectFeature: function(evt) {
            var row = this.resultsGrid.row(evt);

            // zoom to feature
            if (row) {
                var data = row.data;
                if (data) {
                    var selected = array.filter(this.selectionResults, function(selectionResult) {
                        if (selectionResult.id === data.id) {
                            return true;
                        }
                    });
                    var feature = {},
                        extent = null;
                    if (selected[0].geometry.type === 'point') {
                        feature.geometry = new Point(selected[0].geometry);
                        extent = this.getExtentFromPoint(feature);
                    } else if (selected[0].geometry.type === 'polyline') {
                        feature.geometry = new Polyline(selected[0].geometry);
                        extent = feature.geometry.getExtent();
                    } else if (selected[0].geometry.type === 'polygon') {
                        feature.geometry = new Polygon(selected[0].geometry);
                        extent = feature.geometry.getExtent();
                    }

                    this.zoomToExtent(extent);
                }
            }
        },

        clearResults: function() {
            this.results = null;
            this.nearbyArea = null;
            this.clearSelectionLayer();
            this.clearSelectionGraphics();
            this.clearResultsGrid();
            this.clearMapPointDrop();
            this.clearNearbyArea();
            put(this.clearDropButton.domNode, '.off');
            this.dropPointButton.set('label', 'Ready to drop point!');
        },

        clearResultsGrid: function() {
            if (this.resultStore) {
                this.resultsStore.setData([]);
            }
            if (this.resultsGrid) {
                this.resultsGrid.refresh();
            }
            put(this.nearbyResultsGrid, '.off');
            if (this.gridDialog) {
                this.gridDialog.hide();
            }
        },

        _onQueryChange: function(queryIdx) {
            if (queryIdx >= 0 && queryIdx < this.queries.length) {
                this.queryIdx = queryIdx;
            }
        }
    });
});