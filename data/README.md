# data

| Path | In git | What |
|---|---|---|
| `raw/` | no | Scans (`.ply`) and Power Wave Manager exports, as they came off the machines |
| `manifest.csv` | yes | One row per raw file: where it is stored and its SHA-256 |
| `runs/tests.csv` | yes | One row per weld or stretch welded: commanded WFS, travel speed and voltage |
| `runs/beads.csv` | yes | What is on each plate: position, name, kind (single, line, cut), test |
| `runs/stretches.csv` | yes | Limits of each stretch of a line, its test and the controller schedule that held it |
| `runs/arc_feedback.csv` | yes | Mean arc current and voltage the Power Wave logged for each test |

A test id names one weld, not one parameter set: tests 3 and 8 share 300/25/18 and are two welds. The controller schedule is stored apart from the test because schedule numbers get re-entered (line D used schedules 1 to 5 with new values).
