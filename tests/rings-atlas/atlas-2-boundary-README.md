# Atlas-2 boundary behavior harness (G2 partial)

Command: `node tests/rings-atlas/atlas-2-boundary.cjs`.

Uses **real `analyseRoute`** and the actual distance/geometry/lookup helpers extracted from `index.html`, evaluated against synthetic GeoJSON rectangles with no real GPS. Cases: within-prefecture city boundary, prefecture border, foreign ADM1/ADM2 crossing, country border, absent ADM2, single long segment crossing a boundary, distance normalization, empty route. Node assertions fail if the real source behaves differently.

**Important limitation:** The current `analyseRoute` attributes an entire segment's distance to its **midpoint location**. It does not mathematically clip the line at the polygon border. For sparse GPS with a long segment crossing a border, only one side can receive the segment. Test intentionally asserts this current behavior to avoid falsely claiming geographical precision.

This validates existing implementation behavior only, not the correctness of real-world country border precision, GPS sampling gaps, or that Atlas's proposed cache schema is ready. Previous #273 validates later aggregated distances, not raw geography classification; this adds the missing upstream synthetic classifier checks.

Never add real user GPS, login tokens, DB calls or production access. G0 iPhone Safari test and candidate A real all-period snapshot capacity measurements are still OPEN. No merge/deploy authorization.
