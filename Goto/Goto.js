define([
  // basics
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',

  'dojo/on',
  'dojo/keys',

  'dijit/TooltipDialog',
  'dijit/popup',

  'put-selector',

  '//cdnjs.cloudflare.com/ajax/libs/proj4js/2.2.1/proj4.js',

  // mixins & base classes
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',

  // templates & widget css
  'dojo/text!./Goto/templates/Goto.html',
  'xstyle/css!./Goto/css/Goto.css',

  // not referenced
  'dijit/form/Button',
  'dijit/form/TextBox',
  'dijit/form/Select'
], function(
  declare, lang, array,
  on, keys,
  TooltipDialog, popup,
  put,
  proj4,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
  template, css
) {

  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    widgetsInTemplate: true,
    templateString: template,
    baseClass: 'gis_GotoDijit',

    coordTypeTemplates: {
      'latlon': {
        examples: ['-100.1234 30.1234', '118&deg;44\'24.844\" W 35&deg;33\'34.36\" N', '46:24:37.613N  9:25:59.067E'],
        helpText: 'The input accepts longitude first, then latitude in Decimal degrees (DD) or Degrees, Minutes, Seconds (DMS) formats. Hemisphere designation (NSEW) are optional. The coordinate parts may be separated by spaces, colons, or conventional markup (&deg;, \', and ").'
      },
      'utm': {
        examples: ['767882.527 E  4001950.654 N Zone 16N', '665539.235E  5876246.228N 51S'],
        helpText: 'The input accepts Northing or Easting first, but coordinate designation letter is mandatory (NE). The word "Zone" is optional. The hemisphere designation (NS) is optional and defaults to N.'
      },
      'mgrs': {
        examples: ['4QFJ123456', '14SMF6373224867', '10UFD30'],
        helpText: 'The input accepts a grid zone designator (4Q), grid square id (FJ), and an even number of additional precision numbers (12345678). See <a href="http://en.wikipedia.org/wiki/Military_grid_reference_system" target="_blank">wikipedia entry</a> for additional info.'
      }
    },

    postCreate: function() {
      this.inherited(arguments);
      this.setupConnections();
    },
    setupConnections: function() {
      this.helpTooltip = new TooltipDialog({
        id: this.baseClass + '_helpTooltip',
        style: 'width: 300px;',
        content: '',
        onBlur: lang.hitch(this, function(){
            popup.close(this.helpTooltip);
        })
      });
      on(this.questionIconNode, 'click', lang.hitch(this, 'showCoordHelp'));
      this.gotoTypeSelect.on('change', lang.hitch(this, 'updateHintText'));
      this.coordinateTextBox.on('keypress', lang.hitch(this, 'handleCoordInput'));
      this.goButton.on('click', lang.hitch(this, 'gotoCoordinate'));
    },
    updateHintText: function() {
      var coordTypeDisplay = this.gotoTypeSelect.get('displayedValue');
      var coordType = this.gotoTypeSelect.get('value');
      this.coordinateHintNode.innerHTML = coordTypeDisplay + ' ' + this.coordTypeTemplates[coordType].examples[0];
    },
    showCoordHelp: function() {
      var coordType = this.gotoTypeSelect.get('value');
      var helpString = '<p>' + this.coordTypeTemplates[coordType].helpText + '</p><p><ul>';
      array.forEach(this.coordTypeTemplates[coordType].examples, function(example) {
        helpString += '<li>' + example + '</li>';
      });
      helpString += '</ul></p>';
      this.helpTooltip.set('content', helpString);
      popup.open({
        popup: this.helpTooltip,
        around: this.questionIconNode
      });
      this.helpTooltip.focus();
    },
    handleCoordInput: function(evt) {
      if (evt.charOrCode === keys.ENTER) {
        this.gotoCoordinate();
        return;
      }
    },
    gotoCoordinate: function() {
      var inputCoord = this.coordinateTextBox.get('value');
      var latlongCoord = this.determineLatLongFromCoordinate(inputCoord);
      // console.log(latlongCoord);
      if (latlongCoord !== null && !isNaN(latlongCoord[0]) && !isNaN(latlongCoord[1])) {
        this.map.centerAt(latlongCoord);
      }
    },
    determineLatLongFromCoordinate: function(inputCoord) {
      if (!this.validateInput(inputCoord) || inputCoord === '') {
        return;
      }
      var coordType = this.getCoordinateType();
      if (coordType === 'latlon') {
        var latLon = null;
        latLon = this.parseDms(inputCoord);
        if (latLon.length === 2) {
          // console.log('using dms');
          return latLon;
        }
        latLon = this.parseDec(inputCoord);
        if (latLon.length === 2) {
          // console.log('using decimal degrees');
          return latLon;
        }
        return null;
      } else if (coordType === 'utm') {
        // console.log('using utm');
        return this.parseUtm(inputCoord);
      } else if (coordType === 'mgrs') {
        // console.log('using mgrs');
        return proj4.mgrs.toPoint(inputCoord);
      }
    },
    validateInput: function(inputCoord) {
      if (this.parseDms(inputCoord)) {
        return true;
      }
    },
    getCoordinateType: function() {
      return this.gotoTypeSelect.get('value');
    },
    parseDec: function(decStr) {
      var decRe = /(-?\d+(?:\.\d+))[°,]?([NSEW])?/gi;
      var output = [],
        decMatch, degrees, hemisphere;
      while ((decMatch = decRe.exec(decStr)) !== null) {
        degrees = Number(decMatch[1]);
        hemisphere = decMatch[2] || null;
        if (hemisphere !== null && /[SW]/i.test(hemisphere)) {
          degrees = Math.abs(degrees) * -1;
        }
        output.push(degrees);
      }
      return output;
    },
    parseDms: function(dmsStr) {
      /** Parses a Degrees Minutes Seconds string into a Decimal Degrees number.
       * Created by Jeff Jacobson (http://github.com/JeffJacobson) http://gist.github.com/JeffJacobson/2955437
       * Modified by Brian Bunker, Esri Inc., 9/25/2014, 3:27 pm, while eating grapes
       * @param {string}  dmsStr A string containing a coordinate in either DMS or DD format.
       * @return {Array} If dmsStr is a valid coordinate string, an array of value in decimal degrees will be
       *   returned (matching all instances in the input string).  Otherwise NaN will be returned.
       */
      // Matches DMS coordinates
      var dmsRe = /(-?\d+(?:\.\d+)?)[°:d]?\s?(?:(\d+(?:\.\d+)?)['′:]?\s?(?:(\d+(?:\.\d+)?)["″]?)?)?\s?([NSEW])?/gi;
      // Results of match will be [full coords string, Degrees, minutes (if any), seconds (if any), hemisphere (if any)]
      // E.g., ["40:26:46.302N", "40", "26", "46.302", "N"]
      // E.g., ["40.446195N", "40.446195", undefined, undefined, "N"]
      var output = [],
        dmsMatch, degrees, minutes, seconds, hemisphere;
      while ((dmsMatch = dmsRe.exec(dmsStr)) !== null) {
        degrees = Number(dmsMatch[1]);

        minutes = typeof(dmsMatch[2]) !== 'undefined' ? Number(dmsMatch[2]) / 60 : 0;
        seconds = typeof(dmsMatch[3]) !== 'undefined' ? Number(dmsMatch[3]) / 3600 : 0;
        hemisphere = dmsMatch[4] || null;
        if (hemisphere !== null && /[SW]/i.test(hemisphere)) {
          degrees = Math.abs(degrees) * -1;
        }
        if (degrees < 0) {
          output.push(degrees - minutes - seconds);
        } else {
          output.push(degrees + minutes + seconds);
        }
      }
      return output;
    },
    parseUtm: function(dmsStr) {
      var utmRe = /(-?\d+(?:\.\d+))\s*([NE])\s*(-?\d+(?:\.\d+))\s*([NE])\s+(?:ZONE)?\s?(\d{1,2})\s*([NS])?/gi;
      var output = [],
        utmMatch, northing, easting, zoneNum, hemisphere;
      while ((utmMatch = utmRe.exec(dmsStr)) !== null) {
        if (/[N]/i.test(utmMatch[2])) {
          northing = utmMatch[1];
        } else if (/[E]/i.test(utmMatch[2])) {
          easting = utmMatch[1];
        }
        if (/[N]/i.test(utmMatch[4])) {
          northing = utmMatch[3];
        } else if (/[E]/i.test(utmMatch[4])) {
          easting = utmMatch[3];
        }
        zoneNum = utmMatch[5];
        hemisphere = (/[S]/i.test(utmMatch[6]) ? ' +south' : '');
        output = this.projectUTMToLatLong(northing, easting, zoneNum, hemisphere);
      }
      return output;
    },
    projectUTMToLatLong: function(northing, easting, zone, hemisphere) {
      var utmProj = '+proj=utm +zone=' + String(zone) + hemisphere + ' +ellps=WGS84 +datum=WGS84 +units=m +no_defs';
      var geoProj = proj4.defs('WGS84');
      return proj4(utmProj, geoProj, [easting,northing]);
    }
  });
});
