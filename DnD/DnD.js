define([
  'put-selector',

  'esri/request',
  'esri/graphic',
  'esri/InfoTemplate',
  'esri/urlUtils',
  'esri/Color',

  'esri/geometry/Point',
  'esri/geometry/Multipoint',
  'esri/geometry/webMercatorUtils',
  'esri/geometry/scaleUtils',

  'esri/layers/ArcGISDynamicMapServiceLayer',
  'esri/layers/ArcGISImageServiceLayer',
  'esri/layers/FeatureLayer',

  'esri/symbols/PictureMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleFillSymbol',

  'esri/renderers/SimpleRenderer',

  'dojo/_base/array',
  'dojo/_base/declare',
  'dojo/_base/lang',

  'dojo/on',

  'dojox/data/CsvStore',
  'dojox/encoding/base64',

  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',

  'dojo/text!./DnD/templates/DnD.html',
  'xstyle/css!./DnD/css/DnD.css',

  './DnD/DroppedItem'
], function(
  put,
  request, Graphic, InfoTemplate, urlUtils, Color,
  Point, Multipoint, webMercatorUtils, scaleUtils,
  ArcGISDynamicMapServiceLayer, ArcGISImageServiceLayer, FeatureLayer,
  PictureMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
  SimpleRenderer,
  array, declare, lang,
  on,
  CsvStore, base64,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
  template, css,
  DroppedItem
) {
  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    // description:
    //    Add CSV, images, and service urls to a map via drag-and-drop

    templateString: template,
    baseClass: 'esri-DnD',
    widgetsInTemplate: true,

    // Properties to be sent into constructor
    //list of lat and lon field strings
    latFieldStrings: ['lat', 'latitude', 'y', 'ycenter'],
    longFieldStrings: ['lon', 'long', 'longitude', 'x', 'xcenter'],
    iconSize: 23,
    showManualAdd: true,
    postCreate: function() {
      // summary:
      //    Overrides method of same name in dijit._Widget.
      // tags:
      //    private
      this.droppedItems = {};
      this.layerAddListeners = {};

      this.setupDropZone();
      this.determineShowManualAdd();

      this.inherited(arguments);
    },
    determineShowManualAdd: function() {
      if (!this.showManualAdd) {
        put(this.manualResourceAdd, '.off');
      }
    },
    setupDropZone: function() {
      // Let's verify that we have proper browser support, before
      // moving ahead.
      if (!window.File || !window.FileReader) {
        put(this.dndWarningDiv, '!off');
        return;
      }

      var mapCanvas = this.map.container;
      // Reference
      // http://www.html5rocks.com/features/file
      // http://www.html5rocks.com/tutorials/dnd/basics/
      // https://developer.mozilla.org/En/DragDrop/Drag_Operations
      on(mapCanvas, 'dragenter', lang.hitch(this, function(event) {
        // If we don't prevent default behavior here, browsers will
        // perform the default action for the file being dropped i.e,
        // point the page to the file.
        event.preventDefault();
        this.preventDragleaveTimeout = setTimeout(lang.hitch(this, function() {
          clearTimeout(this.preventDragleaveTimeout);
          this.preventDragleaveTimeout = null;
        }), 200);
        if (!this.hasOwnProperty('overlayNode')) {
          this.overlayNode = put(mapCanvas, 'div.esri-DnD-target[style="height:' + mapCanvas.offsetHeight + 'px"]');
        }
      }));
      on(mapCanvas, 'dragleave', lang.hitch(this, function(event) {
        event.preventDefault();
        if (this.preventDragleaveTimeout === null) {
          put(this.overlayNode, '!');
          delete this.overlayNode;
        }
      }));

      on(mapCanvas, 'dragover', lang.hitch(this, function(event) {
        event.preventDefault();
      }));
      on(mapCanvas, 'drop', lang.hitch(this, 'handleDrop'));

      // also can drop on widget
      on(this.domNode, 'dragenter', lang.hitch(this, function(event) {
        // If we don't prevent default behavior here, browsers will
        // perform the default action for the file being dropped i.e,
        // point the page to the file.
        event.preventDefault();
        this.preventDragleaveTimeout = setTimeout(lang.hitch(this, function() {
          clearTimeout(this.preventDragleaveTimeout);
          this.preventDragleaveTimeout = null;
        }), 200);
        if (!this.hasOwnProperty('overlayNode')) {
          this.overlayNode = put(this.domNode, 'div.esri-DnD-target[style="height:' + this.domNode.offsetHeight + 'px"]');
        }
      }));
      on(this.domNode, 'dragleave', lang.hitch(this, function(event) {
        event.preventDefault();
        if (this.preventDragleaveTimeout === null) {
          put(this.overlayNode, '!');
          delete this.overlayNode;
        }
      }));

      on(this.domNode, 'dragover', lang.hitch(this, function(event) {
        event.preventDefault();
      }));
      on(this.domNode, 'drop', lang.hitch(this, 'handleDrop'));

      on(this.manualAddButton, 'click', lang.hitch(this, 'handleManualAdd'));
    },
    handleManualAdd: function() {
      this.overlayNode = put('div');
      var evt = {};
      if (this.fileInputNode.files.length !== 0) {
        var types = {};
        array.forEach(this.fileInputNode.files, function(file) {
          types[file.type] = file.type;
        });
        evt = {
          dataTransfer: {
            files: this.fileInputNode.files,
            types: Object.keys(types)
          },
          preventDefault: function() {}
        };
        lang.hitch(this, this.handleDrop(evt));
        this.fileInputNode.value = null;
      } else if (this.serviceUrlInputNode.value !== '') {
        evt = {
          dataTransfer: {
            files: null,
            types: ['text/uri-list'],
            getData: lang.hitch(this, function() {
              return this.serviceUrlInputNode.value;
            })
          },
          preventDefault: function() {}
        };
        lang.hitch(this, this.handleDrop(evt));
        this.serviceUrlInputNode.value = null;
      }
    },
    handleDrop: function(event) {
      event.preventDefault();
      put(this.overlayNode, '!');
      delete this.overlayNode;

      if (Object.keys(this.droppedItems).length === 0) {
        put(this.instructionsNode, '.off');
      }

      // Reference
      // http://www.html5rocks.com/tutorials/file/dndfiles/
      // https://developer.mozilla.org/en/Using_files_from_web_applications
      var dataTransfer = event.dataTransfer,
        files = dataTransfer.files,
        types = dataTransfer.types;


      // File drop?
      if (files && files.length === 1) {
        var file = files[0]; // that's right I'm only reading one file

        if (file.type.indexOf('image/') !== -1) {
          // get offset distance from top left corner of map container
          var topOffset = this.map.position.y;
          var leftOffset = this.map.position.x;
          var yPos = event.layerY - topOffset;
          var xPos = event.layerX - leftOffset;
          // create an entry in the DnD widget UI
          var itemId = file.name + xPos + yPos;
          this.droppedItems[itemId] = new DroppedItem({
            map: this.map,
            label: file.name,
            itemId: itemId,
            removeCallback: lang.hitch(this, 'removeDroppedItem')
          }).placeAt(this.containerNode);
          this.droppedItems[itemId].startup();
          // load the resource
          this.handleImage(file, xPos, yPos, itemId);
        } else if (file.name.indexOf('.csv') !== -1) {
          if (this.droppedItems[file.name]) {
            return;
          }
          // create an entry in the DnD widget UI
          this.droppedItems[file.name] = new DroppedItem({
            map: this.map,
            label: file.name,
            itemId: file.name,
            removeCallback: lang.hitch(this, 'removeDroppedItem')
          }).placeAt(this.containerNode);
          this.droppedItems[file.name].startup();
          // load the resource
          this.handleCSV(file);
        } else if (file.name.indexOf('.zip') !== -1) {
          if (this.droppedItems[file.name]) {
            return;
          }
          // create an entry in the DnD widget UI
          this.droppedItems[file.name] = new DroppedItem({
            map: this.map,
            label: file.name,
            itemId: file.name,
            removeCallback: lang.hitch(this, 'removeDroppedItem')
          }).placeAt(this.containerNode);
          this.droppedItems[file.name].startup();
          // load the resource
          this.handleZip(file);
        }
      } else if (types) { // Textual drop?

        // We're looking for URLs only.
        var url;
        array.some(types, function(type) {
          if (type.indexOf('text/uri-list') !== -1) {
            url = dataTransfer.getData('text/uri-list');
            return true;
          } else if (type.indexOf('text/x-moz-url') !== -1) {
            url = dataTransfer.getData('text/plain');
            return true;
          } else if (type.indexOf('text/plain') !== -1) {
            url = dataTransfer.getData('text/plain');
            url = url.replace(/^\s+|\s+$/g, '');
            if (url.indexOf('http') === 0) {
              return true;
            }
          }
          return false;
        });

        if (url) {
          url = url.replace(/^\s+|\s+$/g, '');
          // Check if this URL is a google search result.
          // If so, parse it and extract the actual URL
          // to the search result
          if (url.indexOf('www.google.com/url') !== -1) {
            var obj = urlUtils.urlToObject(url);
            if (obj && obj.query && obj.query.url) {
              url = obj.query.url;
            }
          }

          if (this.droppedItems[url]) {
            return;
          }

          // set up layer add listener
          this.layerAddListeners[url] = on(this.map, 'layer-add-result', lang.hitch(this, 'dndLayerAddComplete', url));

          var serviceType = '',
            layer = null;
          if (url.match(/MapServer\/?$/i)) {
            // ArcGIS Server Map Service?
            serviceType = 'MapServer';
            layer = this.handleMapServer(url);
          } else if (url.match(/(Map|Feature)Server\/\d+\/?$/i)) {
            // ArcGIS Server Map/Feature Service Layer?
            if (url.match(/MapServer/i)) {
              serviceType = 'MapServer Layer';
            } else {
              serviceType = 'FeatureServer Layer';
            }
            layer = this.handleFeatureLayer(url);
          } else if (url.match(/ImageServer\/?$/i)) {
            // ArcGIS Server Image Service?
            serviceType = 'ImageServer';
            layer = this.handleImageService(url);
          } else if (url.match(/FeatureServer\/?$/i)) {
            this.layerAddListeners[url].remove();
            serviceType = 'FeatureServer';
          }

          // create an entry in the DnD widget UI
          this.droppedItems[url] = new DroppedItem({
            map: this.map,
            label: (serviceType !== 'FeatureServer' ? 'Loading url...' : 'Only FeatureServer layers allowed'),
            itemId: url,
            url: url,
            serviceType: serviceType,
            removeCallback: lang.hitch(this, 'removeDroppedItem')
          }).placeAt(this.containerNode);
          this.droppedItems[url].startup();
          this.droppedItems[url].layer = layer;
        }
      }
    },
    handleImage: function(file, x, y, itemId) {
      var reader = new FileReader();
      reader.onload = lang.hitch(this, function() {
        // Create an image element just to find out the image
        // dimension before adding it as a graphic
        var img = put('img');
        img.onload = lang.hitch(this, function() {
          var width = img.width,
            height = img.height;

          // Add a graphic with this image as its symbol
          var symbol = new PictureMarkerSymbol(reader.result,
            width > this.iconSize ? this.iconSize : width,
            height > this.iconSize ? this.iconSize : height);
          var point = this.map.toMap(new Point(x, y));
          var graphic = new Graphic(point, symbol);
          this.map.graphics.add(graphic);
          var geoPoint = webMercatorUtils.webMercatorToGeographic(point);
          this.droppedItems[itemId].graphic = graphic;
          this.droppedItems[itemId].setIcon(reader.result);
          this.droppedItems[itemId].setLabel(file.name + '&nbsp;<span class="sub-label">lat/lon:&nbsp;' + geoPoint.y.toFixed(3) + ', ' + geoPoint.x.toFixed(3) + '</span>');
        });

        img.src = reader.result;
      });
      reader.onprogress = function(evt) {};

      // Note that it's possible to monitor read progress as well:
      // http://www.html5rocks.com/tutorials/file/dndfiles/#toc-monitoring-progress
      // http://www.html5rocks.com/tutorials/file/dndfiles/#toc-reading-files
      reader.readAsDataURL(file);
    },
    dndLayerAddComplete: function(url, evt) {
      this.layerAddListeners[url].remove();
      this.layerAddListeners[url] = null;
      delete this.layerAddListeners[url];

      if (this.droppedItems[url].hasOwnProperty('layer') && this.droppedItems[url].layer.hasOwnProperty('fullExtent')) {
        this.map.setExtent(this.droppedItems[url].layer.fullExtent, true);
      }
    },
    handleMapServer: function(url) {
      var layer = new ArcGISDynamicMapServiceLayer(url, {
        opacity: 0.75,
        id: url
      });
      this.map.addLayer(layer);
      return layer;
    },
    handleFeatureLayer: function(url) {
      var layer = new FeatureLayer(url, {
        opacity: 0.75,
        mode: FeatureLayer.MODE_ONDEMAND,
        infoTemplate: new InfoTemplate(null, '${*}'),
        id: url
      });
      this.map.addLayer(layer);
      return layer;
    },
    handleImageService: function(url) {
      var layer = new ArcGISImageServiceLayer(url, {
        opacity: 0.75,
        id: url
      });
      this.map.addLayer(layer);
      return layer;
    },
    handleCSV: function(file) {
      if (file.data) {
        var decoded = this.bytesToString(base64.decode(file.data));
        this.processCSVData(decoded, file.name);
      } else {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function() {
          this.processCSVData(reader.result, file.name);
        });
        reader.onprogress = function(evt) {};
        reader.readAsText(file);
      }
    },
    handleZip: function(file) {
      var fileName = file.name;
      var name = fileName.split('.');
      //Chrome and IE add c:\fakepath to the value - we need to remove it
      //See this link for more info: http://davidwalsh.name/fakepath
      name = name[0].replace('c:\\fakepath\\', '');

      //Define the input params for generate see the rest doc for details
      //http://www.arcgis.com/apidocs/rest/index.html?generate.html
      var params = {
        'name': name,
        'targetSR': this.map.spatialReference,
        'maxRecordCount': 1000,
        'enforceInputFileSizeLimit': true,
        'enforceOutputJsonSizeLimit': true
      };

      //generalize features for display Here we generalize at 1:40,000 which is approx 10 meters
      //This should work well when using web mercator.
      var extent = scaleUtils.getExtentForScale(this.map, 40000);
      var resolution = extent.getWidth() / this.map.width;
      params.generalize = true;
      params.maxAllowableOffset = resolution;
      params.reducePrecision = true;
      params.numberOfDigitsAfterDecimal = 0;

      var myContent = {
        'filetype': 'shapefile',
        'publishParameters': JSON.stringify(params),
        'f': 'json',
        'callback.html': ''
      };

      //build FormData for request
      var formData = null;
      if (!!window.FormData) {
        formData = new FormData();
        formData.append('file', file);
      }

      //use the rest generate operation to generate a feature collection from the zipped shapefile
      request({
        url: 'http://www.arcgis.com/sharing/rest/content/features/generate',
        content: myContent,
        form: formData,
        handleAs: 'json'
      }).then(
        lang.hitch(this, 'shapefileResult', file),
        lang.hitch(this, 'shapefileFailure', file)
      );
    },
    shapefileResult: function(file, response) {
      if (response.error) {
        this.droppedItems[file.name]._handleErrBack();
        return;
      }
      this.addShapefileToMap(file, response.featureCollection);
    },
    shapefileFailure: function(file, response) {
      this.droppedItems[file.name]._handleErrBack();
    },
    addShapefileToMap: function(file, featureCollection) {
      //add the shapefile to the map and zoom to the feature collection extent
      //If you want to persist the feature collection when you reload browser you could store the collection in
      //local storage by serializing the layer using featureLayer.toJson()  see the 'Feature Collection in Local Storage' sample
      //for an example of how to work with local storage.
      var fullExtent;
      var layers = [];

      array.forEach(featureCollection.layers, lang.hitch(this, function(layer) {
        var infoTemplate = new InfoTemplate('Details', '${*}');
        var featureLayer = new FeatureLayer(layer, {
          infoTemplate: infoTemplate,
          id: file.name
        });
        //associate the feature with the popup on click to enable highlight and zoom to
        featureLayer.on('click', lang.hitch(this, function(event) {
          this.map.infoWindow.setFeatures([event.graphic]);
        }));
        //change default symbol if desired. Comment this out and the layer will draw with the default symbology
        this.changeShapefileRenderer(featureLayer);
        fullExtent = fullExtent ?
          fullExtent.union(featureLayer.fullExtent) : featureLayer.fullExtent;
        layers.push(featureLayer);
      }));
      this.map.addLayers(layers);
      this.map.setExtent(fullExtent.expand(1.25), true);
      var patchHTML = this.droppedItems[file.name]._createPatchHTML(null, layers[0].renderer.symbol);
      this.droppedItems[file.name].setIcon(null, null, patchHTML);
    },
    changeShapefileRenderer: function(layer) {
      //change the default symbol for the feature collection for polygons and points
      var symbol = null;
      switch (layer.geometryType) {
        case 'esriGeometryPoint':
          symbol = new PictureMarkerSymbol(this.getPointSymbolInfo());
          break;
        case 'esriGeometryPolygon':
          symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              new Color([112, 112, 112]), 1), new Color([136, 136, 136, 0.25]));
          break;
      }
      if (symbol) {
        layer.setRenderer(new SimpleRenderer(symbol));
      }
    },
    bytesToString: function(b) {
      var s = [];
      array.forEach(b, function(c) {
        s.push(String.fromCharCode(c));
      });
      return s.join('');
    },
    processCSVData: function(data, filename) {
      var newLineIndex = data.indexOf('\n');
      var firstLine = lang.trim(data.substr(0, newLineIndex)); //remove extra whitespace, not sure if I need to do this since I threw out space delimiters
      var separator = this.getSeparator(firstLine);
      var csvStore = new CsvStore({
        data: data,
        separator: separator
      });

      csvStore.fetch({
        onComplete: lang.hitch(this, function(items) {
          var objectId = 0;
          var featureCollection = this.generateFeatureCollectionTemplateCSV(csvStore, items);
          this.droppedItems[filename].setIcon('data:image/png;base64,' + featureCollection.layerDefinition.drawingInfo.renderer.symbol.imageData, 32);
          var popupInfo = this.generateDefaultPopupInfo(featureCollection);
          var infoTemplate = new InfoTemplate(this.buildInfoTemplate(popupInfo));
          var latField, longField;
          var fieldNames = csvStore.getAttributes(items[0]);
          array.forEach(fieldNames, lang.hitch(this, function(fieldName) {
            var matchId;
            matchId = array.indexOf(this.latFieldStrings,
              fieldName.toLowerCase());
            if (matchId !== -1) {
              latField = fieldName;
            }

            matchId = array.indexOf(this.longFieldStrings,
              fieldName.toLowerCase());
            if (matchId !== -1) {
              longField = fieldName;
            }
          }));

          // Add records in this CSV store as graphics
          array.forEach(items, lang.hitch(this, function(item) {
            var attrs = csvStore.getAttributes(item),
              attributes = {};
            // Read all the attributes for  this record/item
            array.forEach(attrs, function(attr) {
              var value = Number(csvStore.getValue(item, attr));
              attributes[attr] = isNaN(value) ? csvStore.getValue(item, attr) : value;
            });

            attributes.__OBJECTID = objectId;
            objectId++;

            var latitude = parseFloat(attributes[latField]);
            var longitude = parseFloat(attributes[longField]);

            if (isNaN(latitude) || isNaN(longitude)) {
              return;
            }

            var geometry = webMercatorUtils.geographicToWebMercator(new Point(longitude, latitude));
            var feature = {
              'geometry': geometry.toJson(),
              'attributes': attributes
            };
            featureCollection.featureSet.features.push(feature);
          }));

          var featureLayer = new FeatureLayer(featureCollection, {
            infoTemplate: infoTemplate,
            id: filename
          });
          featureLayer.__popupInfo = popupInfo;
          this.map.addLayer(featureLayer);
          this.zoomToData(featureLayer);
        }),
        onError: function(error) {
          console.error('Error fetching items from CSV store: ', error);
        }
      });
    },
    getSeparator: function(string) {
      var separators = [',', '      ', ';', '|'];
      var maxSeparatorLength = 0;
      var maxSeparatorValue = '';
      array.forEach(separators, function(separator) {
        var length = string.split(separator).length;
        if (length > maxSeparatorLength) {
          maxSeparatorLength = length;
          maxSeparatorValue = separator;
        }
      });
      return maxSeparatorValue;
    },
    generateFeatureCollectionTemplateCSV: function(store, items) {
      //create a feature collection for the input csv file
      var featureCollection = {
        'layerDefinition': null,
        'featureSet': {
          'features': [],
          'geometryType': 'esriGeometryPoint'
        }
      };
      featureCollection.layerDefinition = {
        'geometryType': 'esriGeometryPoint',
        'objectIdField': '__OBJECTID',
        'type': 'Feature Layer',
        'typeIdField': '',
        'drawingInfo': {
          'renderer': {
            'type': 'simple',
            'symbol': this.getPointSymbolInfo()
          }
        },
        'fields': [{
          'name': '__OBJECTID',
          'alias': '__OBJECTID',
          'type': 'esriFieldTypeOID',
          'editable': false,
          'domain': null
        }],
        'types': [],
        'capabilities': 'Query'
      };

      var fields = store.getAttributes(items[0]);
      array.forEach(fields, lang.hitch(this, function(field) {
        var value = store.getValue(items[0], field);
        var parsedValue = Number(value);
        if (isNaN(parsedValue)) { //check first value and see if it is a number
          featureCollection.layerDefinition.fields.push({
            'name': field,
            'alias': field,
            'type': 'esriFieldTypeString',
            'editable': true,
            'domain': null
          });
        } else {
          featureCollection.layerDefinition.fields.push({
            'name': field,
            'alias': field,
            'type': 'esriFieldTypeDouble',
            'editable': true,
            'domain': null
          });
        }
      }));
      return featureCollection;
    },
    getPointSymbolInfo: function() {
      return {
        'type': 'esriPMS',
        'url': '',
        'imageData': 'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDozODQzQzc1OTNFOUIxMUUzQTg5MkJGRUVDQUQxNkU3RSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDozODQzQzc1QTNFOUIxMUUzQTg5MkJGRUVDQUQxNkU3RSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkY2REQ1M0IyM0U5ODExRTNBODkyQkZFRUNBRDE2RTdFIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjM4NDNDNzU4M0U5QjExRTNBODkyQkZFRUNBRDE2RTdFIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+3zhYuAAAA29JREFUeNrMmM9rE1EQx2fTbH71R1Laiq3U9iCi4I8WQRA8tBRPCu3Ri6AeBL0U8e9Qbx70YEFpe/FH0SJYSouKglYrtoJUD40hadMkNmnapPmxqTP1rTy3+zbZTYoZ+LKbfbzdz87Mm50XaWtrC6rJbFBlVnVAkvZCe9+NATz0ozpRPTpzplGLqLHA5M2n5TxcL10kDchtR31zp8u3F2S3F/B8x4RsMgq5dAI248t0TmDXrYIJgRDmouzx3vd2dAMedSen4hGQJAlsNXaQUHaHC5TMBiT8s5BLJS4h1FBFgBCmx1YjT7UcPYMPk4WTCUhrdqcbwZwQmZuAgpLrRajpcoEoqQcb2o8Ywogsn0mDkssBzaf7VGqVDTh9rZZvkM+kgM0fqNiyt+Id3u3lzN+RBqKBercdzp/eB2dP7IHWRheEYikYe+eHB5M/IJnK7Vodsotg7lw5Bgfbav9ea2vywNVzh6H3eBtcvvXKCEoSOdNypSbP8DC8HWr3woW+A6L7uVEeTvTbhXKiHMwBNtNAFCYj6z/VIRpqRHmZGsjZqDpULQdIcLLIk7oho5wxMgqfwJpZaEgFpjxKYUeKcxaVYWNKSUBLq5uGUJTgAmvhHqSFyTOYFAPeLDlk4x9XDD1Eq01gar6oOaOeu5hqmSRRkusCjb4JwkJoQ/eJ3wKJ7aUvMAeTrCN1DJh3CiXnUDKdh2t3v1ipQzJ7SRsXKhsngkiKwmVYGAnq3oR/W6KPaxEgPbBVpoJpIIumB6SKcoDeKm3p02HRHIJQURL/QsWKVezd9JDCwVHehFj9gf8FxCdyiHkHqgFoCRVgntp9IOqzNTnE50+G7VDiZhq0z/HFWcswzjof0Hwlsx7WFEB62SDKb7TM9YB607GfpqFUmLXAHKwHv66EPwyPairzOmqBHUtvYXGnEDcL9S/MfDQ8M/xEySQLHAzF8TvLHfM9tRkoHiYZnI+FZ0aeY7gKXLiiqMeoqVKWuWG7iXs0H93I3bS/y9fZrbtR5GFWZkaeIUxW7UpQL1CfSl1RhlvpYlDpRFQEE2Eg71kDVpm9fTGogpLXwlB9eYl6yxqvyv7ZUAyKcusPzOhDTOBxHHtt1EZUHIiHqnF4unIbMX9k9tFgNhmeYG1o2Sba2wtNXX1KNjWUXVs+iTBjlYIR2W8BBgB+dqgi6ZiY/wAAAABJRU5ErkJggg==',
        'contentType': 'image/png',
        'width': this.iconSize,
        'height': this.iconSize,
        'xoffset': 7,
        'yoffset': 11
      };
    },
    generateDefaultPopupInfo: function(featureCollection) {
      var fields = featureCollection.layerDefinition.fields;
      var decimal = {
        'esriFieldTypeDouble': 1,
        'esriFieldTypeSingle': 1
      };
      var integer = {
        'esriFieldTypeInteger': 1,
        'esriFieldTypeSmallInteger': 1
      };
      var dt = {
        'esriFieldTypeDate': 1
      };
      var displayField = null;
      var fieldInfos = array.map(fields,
        lang.hitch(this, function(item) {
          if (item.name.toUpperCase() === 'NAME') {
            displayField = item.name;
          }
          var visible = (item.type !== 'esriFieldTypeOID' &&
            item.type !== 'esriFieldTypeGlobalID' &&
            item.type !== 'esriFieldTypeGeometry');
          var format = null;
          if (visible) {
            var f = item.name.toLowerCase();
            var hideFieldsStr = ',stretched value,fnode_,tnode_,lpoly_,rpoly_,poly_,subclass,subclass_,rings_ok,rings_nok,';
            if (hideFieldsStr.indexOf(',' + f + ',') > -1 ||
              f.indexOf('area') > -1 || f.indexOf('length') > -1 ||
              f.indexOf('shape') > -1 || f.indexOf('perimeter') > -1 ||
              f.indexOf('objectid') > -1 || f.indexOf('_') == f.length - 1 ||
              f.indexOf('_i') == f.length - 2) {
              visible = false;
            }
            if (item.type in integer) {
              format = {
                places: 0,
                digitSeparator: true
              };
            } else if (item.type in decimal) {
              format = {
                places: 2,
                digitSeparator: true
              };
            } else if (item.type in dt) {
              format = {
                dateFormat: 'shortDateShortTime'
              };
            }
          }

          return lang.mixin({}, {
            fieldName: item.name,
            label: item.alias,
            isEditable: false,
            tooltip: '',
            visible: visible,
            format: format,
            stringFieldOption: 'textbox'
          });
        }));

      var popupInfo = {
        title: displayField ? '{' + displayField + '}' : '',
        fieldInfos: fieldInfos,
        description: null,
        showAttachments: false,
        mediaInfos: []
      };
      return popupInfo;
    },
    buildInfoTemplate: function(popupInfo) {
      var json = {
        content: '<table>'
      };

      array.forEach(popupInfo.fieldInfos, function(field) {
        if (field.visible) {
          json.content += '<tr><td valign="top">' + field.label +
            ': <\/td><td valign="top">${' + field.fieldName + '}<\/td><\/tr>';
        }
      });
      json.content += '<\/table>';
      return json;
    },
    zoomToData: function(featureLayer) {
      // Zoom to the collective extent of the data
      var multipoint = new Multipoint(this.map.spatialReference);
      array.forEach(featureLayer.graphics, function(graphic) {
        var geometry = graphic.geometry;
        if (geometry) {
          multipoint.addPoint({
            x: geometry.x,
            y: geometry.y
          });
        }
      });

      if (multipoint.points.length > 0) {
        this.map.setExtent(multipoint.getExtent().expand(1.25), true);
      }
    },
    removeDroppedItem: function(itemId) {
      if (this.droppedItems.hasOwnProperty(itemId) &&
        this.droppedItems[itemId].hasOwnProperty('graphic') &&
        this.droppedItems[itemId].graphic) {
        this.map.graphics.remove(this.droppedItems[itemId].graphic);
        delete this.droppedItems[itemId];
      }

      // maybe it's a layer
      var layerIds = this.map.graphicsLayerIds.slice(0);
      layerIds = layerIds.concat(this.map.layerIds.slice(1));

      array.forEach(layerIds, lang.hitch(this, function(layerId) {
        if (layerId === itemId) {
          this.map.removeLayer(this.map.getLayer(layerId));
          delete this.droppedItems[itemId];
        }
      }));

      // maybe it's erroneously still on the dropped items object
      if (this.droppedItems[itemId]) {
        delete this.droppedItems[itemId];
      }

      if (Object.keys(this.droppedItems).length === 0) {
        put(this.instructionsNode, '!off');
      }
    },
    clearAll: function() {
      this.map.graphics.clear();
      var layerIds = this.map.graphicsLayerIds.slice(0);
      layerIds = layerIds.concat(this.map.layerIds.slice(1));

      array.forEach(layerIds, function(layerId) {
        this.map.removeLayer(this.map.getLayer(layerId));
      });
    }
  });
});