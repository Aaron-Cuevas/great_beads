# Pipeline

One module per section of notebook v7. A section moves into the package when its numbers match the notebook.

| Section | Step | Module | Status |
|---|---|---|---|
| 0 | Configuration | `config` | baseline |
| 1 | Load the scan | `scan.ply` | baseline |
| 2 | Substrate plane and Z alignment | `scan.level` | baseline |
| 3 | In-plane frame | `scan.frame` | baseline |
| 4 | Height map | `scan.raster` | baseline |
| 5 | Biaxial deformation and datum | `scan.datum` | baseline |
| 6 | Separation by surface gradient | `beads.segment` | baseline |
| 7 | Beads, centrelines, divisions | `beads.identify`, `beads.measure`, `models.profile` | baseline |
| 8 | Results and zone map | `beads.uniformity` | baseline |
| 9 | Power Wave log and voltage sweep | `process.powerwave`, `models.current` | baseline |
| 10 | Layer-to-layer correction | `control.layer` | baseline |
| 11 | Run sheet, mass balance, height law, lines, starts, cut line | `process.runs`, `beads.lines`, `models.*`, `control.repair` | baseline |
| 12 | Caliper comparison | `validation.caliper` | baseline |
| 13 | Robot registration and bead placement | `robot.registration`, `robot.fanuc` | baseline |
| 14 | Notes and limitations | `validation.repeatability` | baseline |

*baseline*: only in the notebook. *ported*: in the package, numbers match the notebook. *changed*: numbers differ on purpose, and the DevLog entry says why.
