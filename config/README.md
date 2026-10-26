# config

Three kinds of settings, kept apart as in section 0 of the notebook:

| File | Changes when | Holds |
|---|---|---|
| `setup.yaml` | the hardware changes | wire diameter, stick-out, tip gap, gas flow, reference bar length |
| `pipeline.yaml` | never within a series | plane band, cell size, smoothing, slope threshold, skirt and the other measurement settings |
| `scans/<scan_id>.yaml` | every scan | crop boxes, excluded boxes, bead names, gates and overrides |

Every setting a scan file overrides is stored with the rows that scan produces, so a fit that pools plates can tell which rows were measured with different settings (notebook section 14: changing thresholds makes results incomparable).
