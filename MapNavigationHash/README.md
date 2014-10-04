Map Navigation Hash (History)
======================

#### Overview
Uses dojo/router to enable zooming to next or previous extent using the browser forward and back buttons. The geographic map center and map zoom level is placed on the url.

#### CMV Configuration
Include the following code in js/config/viewer.js:
```javascript
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
```

#### Usage Example
appurl.com/index.htlm#/_longitude_/_latitude_/_zoomLevel_

The application will automatically update the url hash on pan and zoom. Users may also manually edit the route to go to a specific long, lat, and zoom level. A user can bookmark the url in the browser and, on load, the app will zoom and pan to the bookmarked location.

[Click for demo](http://brianbunker.github.com/cmv-widgets)

Screen from Sample page:

![Screenshot](./screenshot.png)
