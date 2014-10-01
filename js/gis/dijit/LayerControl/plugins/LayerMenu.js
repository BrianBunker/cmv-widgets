define([
    'dojo/_base/declare',
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/PopupMenuItem',
    'dijit/MenuSeparator',
    './Transparency'
], function (
    declare,
    Menu,
    MenuItem,
    PopupMenuItem,
    MenuSeparator,
    Transparency
) {
    return declare(Menu, {
        _removed: false, //for future use
        postCreate: function () {
            this.inherited(arguments);
            var control = this.control,
                layer = control.layer,
                controlOptions = control.controlOptions,
                controller = control.controller,
                layerType = control._layerType,
                menu = this;
            //reorder menu items
            if ((layerType === 'vector' && controller.vectorReorder) || (layerType === 'overlay' && controller.overlayReorder)) {
                control._reorderUp = new MenuItem({
                    label: 'Move Up',
                    onClick: function () {
                        controller._moveUp(control);
                    }
                });
                menu.addChild(control._reorderUp);
                control._reorderDown = new MenuItem({
                    label: 'Move Down',
                    onClick: function () {
                        controller._moveDown(control);
                    }
                });
                menu.addChild(control._reorderDown);
                menu.addChild(new MenuSeparator());
            }
            //zoom to layer
            if ((controlOptions.noZoom !== true && controller.noZoom !== true) || (controller.noZoom === true && controlOptions.noZoom === false)) {
                menu.addChild(new MenuItem({
                    label: 'Zoom to Layer',
                    onClick: function () {
                        controller._zoomToLayer(layer);
                    }
                }));
            }
            //transparency
            if ((controlOptions.noTransparency !== true && controller.noTransparency !== true) || (controller.noTransparency === true && controlOptions.noTransparency === false)) {
                menu.addChild(new Transparency({
                    label: 'Transparency',
                    layer: layer
                }));
            }
            //layer swipe
            if (controlOptions.swipe === true || (controller.swipe === true && controlOptions.swipe !== false)) {
                var swipeMenu = new Menu();
                swipeMenu.addChild(new MenuItem({
                    label: 'Vertical',
                    onClick: function () {
                        controller._swipeLayer(layer, 'vertical');
                    }
                }));
                swipeMenu.addChild(new MenuItem({
                    label: 'Horizontal',
                    onClick: function () {
                        controller._swipeLayer(layer, 'horizontal');
                    }
                }));
                if (controlOptions.swipeScope === true) {
                    swipeMenu.addChild(new MenuItem({
                        label: 'Scope',
                        onClick: function () {
                            controller._swipeLayer(layer, 'scope');
                        }
                    }));
                }
                menu.addChild(new PopupMenuItem({
                    label: 'Layer Swipe',
                    popup: swipeMenu
                }));
            }
            //if last child is a separator remove it
            var lastChild = menu.getChildren()[menu.getChildren().length - 1];
            if (lastChild && lastChild.isInstanceOf(MenuSeparator)) {
                menu.removeChild(lastChild);
            }
        }
    });
});