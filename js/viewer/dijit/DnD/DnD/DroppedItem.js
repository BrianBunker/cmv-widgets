define([
  'put-selector',

  'esri/request',

  'esri/geometry/Extent',

  'esri/symbols/jsonUtils',
  'esri/symbols/SimpleFillSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',

  'dojo/_base/array',
  'dojo/_base/declare',
  'dojo/_base/lang',

  'dojo/on',

  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',

  'dojox/gfx',

  'dojo/text!./templates/DroppedItem.html',
  'xstyle/css!./css/DroppedItem.css',

  'require'
], function(
  put,
  esriRequest,
  Extent,
  symbolJsonUtils, SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol,
  array, declare, lang,
  on,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
  gfx,
  template, css,
  require
) {
  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    // description:
    //    Widget to show and interact with items dropped on the map

    templateString: template,
    baseClass: 'esri-DroppedItem',
    widgetsInTemplate: true,

    label: '',
    itemId: '',
    url: '',
    serviceType: '',
    removeIcon: require.toUrl('./images/remove.png'),

    serviceIcons: {
      'defaultIcon': require.toUrl('./images/earth.png'),
      'MapServer': require.toUrl('./images/map.png'),
      'FeatureServer': require.toUrl('./images/warning.png'),
      'MapServer Layer': require.toUrl('./images/map.png'),
      'FeatureServer Layer': require.toUrl('./images/database.png'),
      'ImageServer': require.toUrl('./images/images.png'),
      'loading': require.toUrl('./images/loading.gif')
    },

    postCreate: function() {
      if (this.hasOwnProperty('serviceType') && this.serviceType === 'FeatureServer') {
        this.setIcon(this.serviceIcons.FeatureServer, 20);
      } else if (this.hasOwnProperty('url') && this.url !== '') {
        this.setIcon(this.serviceIcons.loading, 20);
        this._loadServiceInfo(this.url, null);
      } else {
        this.setIcon(this.serviceIcons.loading, 20);
      }
    },
    getLabel: function() {
      return this.label;
    },
    setLabel: function(newLabel) {
      this.label = newLabel;
      this.labelNode.innerHTML = newLabel;
    },
    setIcon: function(icon, size, html) {
      if (html) {
        this.iconNode.outerHTML = html;
        return;
      }
      put(this.iconNode, '[src=' + icon + ']');
      if (size) {
        put(this.iconNode, '[style=width:' + size + 'px;height:' + size + 'px;padding:' + Math.abs(32 - size) / 2 + 'px;]');
      }
    },
    _removeItem: function() {
      if (this.removeCallback) {
        this.removeCallback(this.itemId);
        this.destroyRecursive();
      }
    },
    _loadServiceInfo: function(url, targetNode) {
      esriRequest({
        url: url,
        content: {
          f: 'json'
        },
        handleAs: 'json',
        callbackParamName: 'callback'
      }).then(lang.hitch(this, '_handleLoadedServiceInfo', url, targetNode), lang.hitch(this, '_handleErrBack', url));
    },
    _handleErrBack: function(url) {
      this.label = 'Unable to add resource from url';
      this.labelNode.innerHTML = '<span title="' + url + '">' + this.label + '</span>';
      this.setIcon(this.serviceIcons.FeatureServer, 20);
    },
    _handleLoadedServiceInfo: function(url, targetNode, info) {
      // set the label on the first item loaded
      if (targetNode === null) {
        if (info.hasOwnProperty('documentInfo') && info.documentInfo.hasOwnProperty('Title')) {
          info.name = (info.documentInfo.Title !== '' ? info.documentInfo.Title : null);
        }
        if (!info.name && info.hasOwnProperty('mapName')) {
          info.name = (info.mapName !== '' ? info.mapName : url);
        }
        if (!info.hasOwnProperty('name') || !info.name) {
          info.name = url;
        }
        this.label = this.serviceType === '' ? info.name : info.name + '&nbsp;<span class="sub-label">(' + this.serviceType + ')</span>';
        this.labelNode.innerHTML = '<span title="' + url + '">' + this.label + '</span>';
        var icon = this.serviceType === '' ? 'defaultIcon' : this.serviceType;
        if (this.serviceIcons.hasOwnProperty(icon)) {
          this.setIcon(this.serviceIcons[icon], 20);
        }
        // check if a MapServer/Feature server root directory (not a layer)
        //  if a root directory, recursively call _loadService info on each of
        //  the layers
        if (info.hasOwnProperty('layers') && info.layers.length >= 1) {
          array.forEach(info.layers, lang.hitch(this, function(layer, i) {
            this._loadServiceInfo(url + '/' + i, this.containerNode);
          }));
        } else if (info.hasOwnProperty('drawingInfo')) {
          var serviceLayerHTML = '<div>';
          serviceLayerHTML += '<div class="layersInfo">' + this._buildLayersInfo(this._getRendererSymbolArray(info.drawingInfo.renderer)) + '</div>';
          serviceLayerHTML += '</div>';
          this.containerNode.innerHTML = serviceLayerHTML;
        }
      } else if (targetNode !== undefined) {
        put(targetNode, 'div.layerTitle', info.name);
        var outHTML = '<div>';
        outHTML += '<div class="layersInfo">' + this._buildLayersInfo(this._getRendererSymbolArray(info.drawingInfo.renderer)) + '</div>';
        outHTML += '</div>';
        targetNode.innerHTML += outHTML;
      }
    },
    _getRendererSymbolArray: function(rendererJson) {
      if (rendererJson.hasOwnProperty('uniqueValueInfos')) {
        return rendererJson.uniqueValueInfos;
      } else if (rendererJson.hasOwnProperty('symbol')) {
        return [rendererJson];
      }
    },
    _buildLayersInfo: function(layersInfo) {
      var layersHTML = array.map(layersInfo, lang.hitch(this, '_buildLayerInfo')).join('');
      return layersHTML;
    },
    _buildLayerInfo: function(layerInfo) {
      var layerHTML = '<div class="layerInfo">';
      if (layerInfo.symbol.type === 'esriPMS') {
        layerHTML += '<img class="iconNode iconPatch" src="data:' + layerInfo.symbol.contentType + ';base64,' + layerInfo.symbol.imageData + '">';
      } else {

        layerHTML += this._createPatchHTML(layerInfo);
      }
      layerHTML += '<div class="labelNode">' + (layerInfo.label !== '' ? layerInfo.label : 'No label') + '</div>';
      layerHTML += '</div>';
      layerHTML += '<div class="clearer" style="height:5px;"></div>';
      return layerHTML;
    },
    _createPatchHTML: function(layerInfo, symbol) {
      if (!symbol) {
        // create symbol obj from json
        symbol = this._createSymbol(layerInfo);
      }
      // use gfx to create symbol surface/image
      var docFrag = put('div.iconNode');
      var surface = gfx.createSurface(docFrag, 32, 32);
      var descriptors = symbolJsonUtils.getShapeDescriptors(symbol);
      var shape = surface.createShape(descriptors.defaultShape)
        .setFill(descriptors.fill)
        .setStroke(descriptors.stroke);
      shape.applyTransform({
        dx: 16,
        dy: 16
      });
      return docFrag.outerHTML;
    },
    _createSymbol: function(layerInfo) {
      if (layerInfo.hasOwnProperty('symbol') && layerInfo.symbol.hasOwnProperty('type')) {
        var type = layerInfo.symbol.type;
        if (type === 'esriSFS') {
          return new SimpleFillSymbol(layerInfo.symbol);
        } else if (type === 'esriSLS') {
          return new SimpleLineSymbol(layerInfo.symbol);
        } else if (type === 'esriSMS') {
          return new SimpleMarkerSymbol(layerInfo.symbol);
        }
      }
    }
  });
});