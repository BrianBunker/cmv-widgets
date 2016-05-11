define([
  'esri/units',
  'esri/geometry/Extent',
  'esri/config',
  'esri/tasks/GeometryService',
  'esri/layers/ImageParameters'
], function(units, Extent, esriConfig, GeometryService, ImageParameters) {

  // url to your proxy page, must be on same machine hosting you app. See proxy folder for readme.
  esriConfig.defaults.io.proxyUrl = 'proxy/proxy.ashx';
  esriConfig.defaults.io.alwaysUseProxy = false;
  // url to your geometry server.
  esriConfig.defaults.geometryService = new GeometryService('http://tasks.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer');

  //image parameters for dynamic services, set to png32 for higher quality exports.
  var imageParameters = new ImageParameters();
  imageParameters.format = 'png32';

  return {
    // used for debugging your app
    isDebug: false,

    //default mapClick mode, mapClickMode lets widgets know what mode the map is in to avoid multipult map click actions from taking place (ie identify while drawing).
    defaultMapClickMode: 'identify',
    // map options, passed to map constructor. see: https://developers.arcgis.com/javascript/jsapi/map-amd.html#map1
    mapOptions: {
      basemap: 'streets',
      center: [-96.59179687497497, 39.09596293629694],
      zoom: 5,
      sliderStyle: 'small'
    },
    // panes: {
    // 	left: {
    // 		splitter: true
    // 	},
    // 	right: {
    // 		id: 'sidebarRight',
    // 		placeAt: 'outer',
    // 		region: 'right',
    // 		splitter: true,
    // 		collapsible: true
    // 	},
    // 	bottom: {
    // 		id: 'sidebarBottom',
    // 		placeAt: 'outer',
    // 		splitter: true,
    // 		collapsible: true,
    // 		region: 'bottom'
    // 	},
    // 	top: {
    // 		id: 'sidebarTop',
    // 		placeAt: 'outer',
    // 		collapsible: true,
    // 		splitter: true,
    // 		region: 'top'
    // 	}
    // },
    // collapseButtonsPane: 'center', //center or outer

    // operationalLayers: Array of Layers to load on top of the basemap: valid 'type' options: 'dynamic', 'tiled', 'feature'.
    // The 'options' object is passed as the layers options for constructor. Title will be used in the legend only. id's must be unique and have no spaces.
    // 3 'mode' options: MODE_SNAPSHOT = 0, MODE_ONDEMAND = 1, MODE_SELECTION = 2
    operationalLayers: [{
      type: 'feature',
      url: 'http://sampleserver3.arcgisonline.com/ArcGIS/rest/services/SanFrancisco/311Incidents/FeatureServer/0',
      title: 'San Francisco 311 Incidents',
      options: {
        id: 'sf311Incidents',
        opacity: 1.0,
        visible: true,
        outFields: ['req_type', 'req_date', 'req_time', 'address', 'district'],
        mode: 0
      }
    }, {
      type: 'dynamic',
      url: 'http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/PublicSafety/PublicSafetyOperationalLayers/MapServer',
      title: 'Louisville Public Safety',
      slider: true,
      noLegend: false,
      collapsed: false,
      sublayerToggle: false, //true to automatically turn on sublayers
      options: {
        id: 'louisvillePubSafety',
        opacity: 1.0,
        visible: true,
        imageParameters: imageParameters
      },
      identifyLayerInfos: {
        layerIds: [2, 4, 5, 8, 12, 21]
      }
    }, {
      type: 'dynamic',
      url: 'http://sampleserver6.arcgisonline.com/arcgis/rest/services/DamageAssessment/MapServer',
      title: 'Damage Assessment',
      slider: true,
      noLegend: false,
      collapsed: false,
      options: {
        id: 'DamageAssessment',
        opacity: 1.0,
        visible: true,
        imageParameters: imageParameters
      },
      layerControlLayerInfos: {
        swipe: true
      }
    }],
    // set include:true to load. For titlePane type set position the the desired order in the sidebar
    widgets: {
      growler: {
        include: true,
        id: 'growler',
        type: 'domNode',
        path: 'gis/dijit/Growler',
        srcNodeRef: 'growlerDijit',
        options: {}
      },
      geocoder: {
        include: true,
        id: 'geocoder',
        type: 'domNode',
        path: 'gis/dijit/Geocoder',
        srcNodeRef: 'geocodeDijit',
        options: {
          map: true,
          mapRightClickMenu: true,
          geocoderOptions: {
            autoComplete: true,
            arcgisGeocoder: {
              placeholder: 'Enter an address or place'
            }
          }
        }
      },
      identify: {
        include: false,
        id: 'identify',
        type: 'titlePane',
        path: 'gis/dijit/Identify',
        title: 'Identify',
        open: false,
        position: 3,
        options: 'config/identify'
      },
      basemaps: {
        include: true,
        id: 'basemaps',
        type: 'domNode',
        path: 'gis/dijit/Basemaps',
        srcNodeRef: 'basemapsDijit',
        options: 'config/basemaps'
      },
      mapInfo: {
        include: false,
        id: 'mapInfo',
        type: 'domNode',
        path: 'gis/dijit/MapInfo',
        srcNodeRef: 'mapInfoDijit',
        options: {
          map: true,
          mode: 'dms',
          firstCoord: 'y',
          unitScale: 3,
          showScale: true,
          xLabel: '',
          yLabel: '',
          minWidth: 286
        }
      },
      scalebar: {
        include: true,
        id: 'scalebar',
        type: 'map',
        path: 'esri/dijit/Scalebar',
        options: {
          map: true,
          attachTo: 'bottom-left',
          scalebarStyle: 'line',
          scalebarUnit: 'dual'
        }
      },
      locateButton: {
        include: true,
        id: 'locateButton',
        type: 'domNode',
        path: 'gis/dijit/LocateButton',
        srcNodeRef: 'locateButton',
        options: {
          map: true,
          publishGPSPosition: true,
          highlightLocation: true,
          useTracking: true,
          geolocationOptions: {
            maximumAge: 0,
            timeout: 15000,
            enableHighAccuracy: true
          }
        }
      },
      overviewMap: {
        include: true,
        id: 'overviewMap',
        type: 'map',
        path: 'esri/dijit/OverviewMap',
        options: {
          map: true,
          attachTo: 'bottom-right',
          color: '#0000CC',
          height: 100,
          width: 125,
          opacity: 0.30,
          visible: false
        }
      },
      homeButton: {
        include: true,
        id: 'homeButton',
        type: 'domNode',
        path: 'esri/dijit/HomeButton',
        srcNodeRef: 'homeButton',
        options: {
          map: true,
          extent: new Extent({
            xmin: -180,
            ymin: -85,
            xmax: 180,
            ymax: 85,
            spatialReference: {
              wkid: 4326
            }
          })
        }
      },
      legend: {
        include: true,
        id: 'legend',
        type: 'titlePane',
        path: 'esri/dijit/Legend',
        title: 'Legend',
        open: false,
        position: 0,
        options: {
          map: true,
          legendLayerInfos: true
        }
      },
      layerControl: {
        include: true,
        id: 'layerControl',
        type: 'titlePane',
        path: 'gis/dijit/LayerControl',
        title: 'Layers',
        open: false,
        position: 0,
        options: {
          map: true,
          layerControlLayerInfos: true,
          separated: true,
          vectorReorder: true,
          overlayReorder: true
        }
      },
      gotocoord: {
        include: true,
        id: 'goto',
        type: 'titlePane',
        canFloat: true,
        position: 1,
        path: 'viewer/dijit/Goto/Goto',
        title: 'Go To Coordinate',
        options: {
          map: true
        }
      },
      dnd: {
        include: true,
        id: 'dnd',
        type: 'titlePane',
        canFloat: true,
        position: 2,
        path: 'viewer/dijit/DnD/DnD',
        title: 'Drag and Drop',
        options: {
          map: true
        }
      },
      nearby: {
        include: true,
        id: 'nearby',
        type: 'titlePane',
        canFloat: true,
        path: 'viewer/dijit/Nearby/Nearby',
        title: 'Nearby',
        open: false,
        position: 5,
        options: {
          map: true,
          mapClickMode: true
        }
      },
      help: {
        include: true,
        id: 'help',
        type: 'floating',
        path: 'gis/dijit/Help',
        title: 'Help',
        options: {}
      },
      navhash: {
        include: true,
        id: 'navhash',
        type: 'invisible',
        path: 'viewer/dijit/MapNavigationHash/MapNavigationHash',
        title: 'Map Navigation Hash',
        options: {
          map: true
        }
      }

    }
  };
});
