# model

`bead_model.json` is written by `great_beads.export` and nothing else. The planner reads it through the generated `planner/js/model.js`, so the planner still opens with a double click. The planner never refits.

| Block | Holds |
|---|---|
| `meta` | model version, date, pipeline commit, scans and tests used |
| `setup` | wire diameter, CTWD, gas |
| `mass_balance` | R1: m, its standard error, RMSE, lambda range |
| `height_law` | R2: a, b, c, reference voltage, rms, ranges |
| `profile` | R3: parabola, A = (2/3) w h |
| `current` | R4: I(WFS, V) coefficients and spread |
| `transitions` | step width sigma, offset of the change |
| `ends` | start and stop parameters, status |
| `validity` | tested WFS, TS and V; stable WFS window |
| `rows` | the measured rows behind every fit |
