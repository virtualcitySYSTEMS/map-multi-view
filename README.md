# @vcmap/multi-view

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

The multi-view plugin adds multiple views/maps to the main VcsMap. When navigating in the main map, all views are updated. It is also possible to move in one of the multi-views. Clicking on the view title will change the viewpoint in the main map.

The multi-view plugin supports the following maps which can be shown and changed in the sideMap.

- 2D
- 3D
- Oblique
- Panorama
- Oblique multi-view (north/south/east/west)

### MapNames

The SideMaps always have the following name: `${className}-multi-view`, which can be used in layer.mapNames to show a layer just in the sideMap.

### Configuration Options

- `activeOnStartup` can be used to set the multi-view plugin active on startup. If not set, the plugin is inactive on startup.
- `startingSideMap` can be used to set the initial map in the sideMap. The value can be one of the following: `OpenlayersMap`, `CesiumMap`, `ObliqueMap`, `PanoramaMap`, `ObliqueMultiView`. Per default the first map in the list of `allowedSideMaps` is used.
- `allowedSideMaps` can be used to set which maps are allowed in the sideMap. The value can be an array of the following: `OpenlayersMap`, `CesiumMap`, `ObliqueMap`, `PanoramaMap`, `ObliqueMultiView`. If not set, all sideMaps are available.
- `obliqueCollection` can be used to set the oblique collection for the `ObliqueMap` and `ObliqueMultiView`. If not set, the oblique collection is taken from the mainMap, or if there is no Oblique mainMap just the first available oblique collection is used.
