# Atlas-2 synthetic GPS border test (G2 partial)

Run with Node.js 18+: node tests/rings-atlas/atlas-2-gps-boundary.cjs

The test reads real index.html and executes its actual analyseRoute, distanceKm, GeoJSON point-in-polygon, bounding-box and municipality/country/ADM1/ADM2 lookup functions in a Node VM. Geometry is entirely synthetic rectangular GeoJSON, and route coordinates are fictional. Fixed expected segment index assignments are independently provided; output checks distances and category maps, overseas ADM1/ADM2 and target-distance scaling.

Cases: CITY_BORDER, COUNTRY_AND_ADM2, TARGET_SCALING, ADM1_WITHOUT_ADM2, SINGLE_POINT.

Crucial scope: current production code classifies GPS segment by its midpoint, assigning the whole segment to the midpoint's region; it DOES NOT clip/split a sparse crossing segment on polygon boundaries. Pass means conformity to current implementation, not precise geometric line clipping or proof of real-world correctness. This is a G2 partial gate, not completion.

Still pending: holes/multipolygons/border-touching/poor GPS density; Atlas-1 iPhone Safari evidence; A snapshot real capacity measurement and ALL/year/month scope; independent audit and user approval. No app or database changes, no personal runs, no production publishing.
