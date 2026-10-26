# WAAM Bead Planner

Source of the planner, split into files.

## Run from Visual Studio Code

1. File > Open Folder, and choose this folder.
2. Press F5 and pick "Open in Edge" or "Open in Chrome".

Opening `index.html` with a double click also works. No install, no server, no internet.

## Files

| File | Contents |
|---|---|
| `index.html` | Layout of the window: toolbars, viewport, side panel, timeline, status bar |
| `css/styles.css` | Colours and styles |
| `js/app.js` | Model, plate frame, panels, 3D view, timeline, graphs |
| `vendor/three.min.js` | three.js r128, the 3D library |

## Where things are in `js/app.js`

| Section | What to change there |
|---|---|
| `model` | The 18 measured beads (`BEADS`) and the height and start coefficients (`MODEL`) |
| `state` | Default values on opening, and the preloaded plate (`SEED`) |
| `plate frame` | Plane fit to the five touches, axes and offset |
| `process` | `compute()`: solves area, wire feed or travel, and the shape |
| `side panels` | The panels and fields of each tab |
| `3D viewport` | Mesh of the bead, camera, gizmo |
| `timeline` | Playback and ruler |
| `charts` | The three graphs and the plate view |
