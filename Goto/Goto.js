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

    // mixins & base classes
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    // default coord types
    './Goto/CoordTypes',

    //store for select
    'dojo/data/ObjectStore',
    'dojo/store/Memory',

    //graphics layer
    'esri/graphic',
    'esri/geometry/Point',
    'esri/SpatialReference',
    './Goto/images/icon',
    'esri/symbols/PictureMarkerSymbol',

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
    _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
    CoordTypes, ObjectStore, Memory,
    Graphic, Point, SpatialReference, icon, PictureMarkerSymbol,
    template
) {

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: template,
        baseClass: 'gis_GotoDijit',
        graphicCoordinate: null,
        _setGraphicCoordinateAttr: function(coordinate) {
            this.graphicCoordinate = coordinate;
            if (coordinate) {
                var point = new Point(coordinate, new SpatialReference({
                    wkid: 4326
                }));
                this.graphic.setGeometry(point);
                this.graphic.show();
            } else {
                this.graphic.hide();
            }
        },
        defaultCoordTypes: CoordTypes,
        useDefault: true,
        coordTypes: [],
        coordStore: null,
        postMixInProperties: function() {
            this.inherited(arguments);
            this.setCoordStore();
        },
        postCreate: function() {
            this.inherited(arguments);
            this.setCoordStore();
            this.setupConnections();
            this.initGraphics();
        },
        setCoordStore: function() {
            if (this.useDefault) {
                this.coordTypes = this.defaultCoordTypes.concat(this.coordTypes);
            }
            var store = new Memory({
                data: this.coordTypes
            });
            this.coordStore = new ObjectStore({
                objectStore: store
            });
        },
        setupConnections: function() {
            this.helpTooltip = new TooltipDialog({
                id: this.baseClass + '_helpTooltip',
                style: 'width: 300px;',
                content: '',
                onBlur: lang.hitch(this, function() {
                    popup.close(this.helpTooltip);
                })
            });
            on(this.questionIconNode, 'click', lang.hitch(this, 'showCoordHelp'));
            this.gotoTypeSelect.on('change', lang.hitch(this, 'updateForm'));
            this.coordinateTextBox.on('keypress', lang.hitch(this, 'handleCoordInput'));
            this.goButton.on('click', lang.hitch(this, 'gotoCoordinate'));
        },
        initGraphics: function() {
            var symbol = new PictureMarkerSymbol(icon.url, 32, 32);
            symbol.setOffset(0, 20);
            this.graphic = new Graphic();
            this.graphic.setSymbol(symbol);
            this.map.graphics.add(this.graphic);
        },
        updateForm: function() {
            var coordTypeDisplay = this.gotoTypeSelect.get('displayedValue');
            var coordType = this.getCoordinateType();

            this.coordinateTextBox.set('value', coordType.default || '');
            this.coordinateHintNode.innerHTML = coordTypeDisplay + ' ' + (coordType.examples && coordType.examples.length ? coordType.examples[0] : '');
        },
        showCoordHelp: function() {
            var coordType = this.getCoordinateType();
            var helpString = '<p>' + (coordType.helpText ? coordType.helpText : '') + '</p><p><ul>';
            array.forEach(coordType.examples, function(example) {
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
            if (latlongCoord && !isNaN(latlongCoord[0]) && !isNaN(latlongCoord[1])) {
                this.map.centerAt(latlongCoord);
                this.set('graphicCoordinate', latlongCoord);
            } else {
                this.set('graphicCoordinate', null);
            }
        },
        determineLatLongFromCoordinate: function(inputCoord) {
            if (!inputCoord) {
                return null;
            }
            var coordType = this.getCoordinateType();
            return coordType ? coordType.toLatLong(inputCoord) : null;
        },
        getCoordinateType: function() {
            var key = this.gotoTypeSelect.get('value');
            return array.filter(this.coordTypes, lang.hitch(this, function(coord) {
                return coord.id === key;
            }))[0] || {};
        }
    });
});
