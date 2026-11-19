# Rings Atlas – same-document geographic view, first real UI change

This PR **implements** a first Atlas UI view while retaining ALL existing dashboard functionality. A button on the current dashboard opens a distinct geographic-details view in the same authenticated document; a back button or Escape restores the original dashboard. It moves the **same six nodes** (countryHeading, countryList, regionSection, admin2Section, prefectureSection, citySection) into Atlas and back. No duplicate IDs, no copying of private data. Existing event listeners on these nodes survive the move and region map linkage keeps the same IDs. The map, filters and activity analysis stay in their exact original application.

Design intentionally keeps the existing homepage geographic detail *visible in its original position by default*. Neither existing elements nor selectors are deleted. Only after Atsuo's explicit separate approval and G0 visual audit may home default visibility change. This is **not** a separate rings-atlas.html route, and no new Supabase, storage, API, or snapshot implementation is made.

Run offline source contract test:
  node tests/rings-atlas/atlas-relocation-contract.cjs

Auth: real login continues inside index.html; Atlas itself does not authenticate. It refuses to open if appRoot is not displayed, returns home on bfcache restoration and observed appRoot becoming hidden. It does not claim to prove real G3 owner isolation beyond reusing the canonical authenticated document. If Safari returns to the page with stale content, existing appRoot's auth lifecycle must be audited independently; private data is not duplicated, but that does not prove account revalidation.

UI audits to perform before production: iPhone Safari width 320/375, iPad portrait/landscape, open/close/keyboard focus/Escape, language switching, ALL/YEAR/MONTH while Atlas is open, country/prefecture/city map clicks/hilights, logout and bfcache, map redrawing and visible filters. Existing dashboard view must remain unchanged when Atlas is closed. Clicking a map region with Atlas open must preserve existing behavior and map-layer state. Do not infer dynamic map-link equivalence from a static contract test.

Scope: one existing index.html edited; two new source/test files plus this note. No Build change, DB change, persistent cache, new data download, HTML destruction or homepage feature removal. PR is Draft. Merge/deploy is not authorized.
