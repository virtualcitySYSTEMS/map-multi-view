# v3.0.5

- fixes a bug where oblique multiview images were not updated when the active map's collection changed and `obliqueCollectionName` not set

# v3.0.4

- fixes a bug where the switch button would not be shown.

# v3.0.3

- changed the name of the sideMaps, they now are called `${className}-multi-view` This can be used together with layer.mapNames, to show a layer just in the sideMap.

# v3.0.2

- changed the default behaviour on initialize. Default is now all possible SideMaps.

# v3.0.1

- small fixes to the i18n texts

# v3.0.0

- Updated @vcmap/core and @vcmap/ui to version 6.2
- Added new SideMaps (3d/2D/Oblique/PanoramaMap)
- Added new Button do enable/disable View Sync
- Added new Button to switch Main Map and Sidemap
- Added configuration options
  - activeOnStartup
  - allowedSideMaps
  - startingSideMap
  - obliqueCollectionName

# v2.0.2

- fixes bug where loading from state failed

# v2.0.1

- fixes bug which caused multiView to not load from (url) state

# v2.0.0

- updates @vcmap/core and @vcmap/ui to 6.x
- updates state to be not included in create-link when multiView is not active
- fixes a bug where views could not be moved by dragging when CesiumMap was selected

# v1.1.0

- adds panel manager
