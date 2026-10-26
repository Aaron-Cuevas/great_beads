# References

One row per method, with the place in the pipeline that uses it.

| Method | Reference | Used in |
|---|---|---|
| RANSAC | Fischler, M. A., Bolles, R. C. (1981). Random sample consensus: a paradigm for model fitting with applications to image analysis and automated cartography. *Communications of the ACM* 24(6), 381-395. | Section 2, `scan.level` |
| Minimum-area rectangle | Freeman, H., Shapira, R. (1975). Determining the minimum-area encasing rectangle for an arbitrary closed curve. *Communications of the ACM* 18(7), 409-413. | Section 3, `scan.frame` |
| Catmull-Rom spline | Catmull, E., Rom, R. (1974). A class of local interpolating splines. In *Computer Aided Geometric Design*, Academic Press, 317-326. | Section 7, `beads.measure` |
| Limits of agreement | Bland, J. M., Altman, D. G. (1986). Statistical methods for assessing agreement between two methods of clinical measurement. *The Lancet* 327(8476), 307-310. | Section 12, `validation.caliper` |
| Kabsch rotation | Kabsch, W. (1976). A solution for the best rotation to relate two sets of vectors. *Acta Crystallographica A* 32(5), 922-923. | Section 13, `robot.registration` |
| Melting rate | Lesnewich, A. (1958). Control of melting rate and metal transfer in gas-shielded metal-arc welding. *Welding Journal* 37. | R4, `models.current` |
