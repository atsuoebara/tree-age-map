# Atlas-2 / synthetic equivalence harness (G2 partial)

Run from a checked-out PR branch with Node.js 18+:

```sh
node tests/rings-atlas/atlas-2-equivalence.cjs
```

The script reads **the repository's actual `index.html`**, extracts its `buildSelectedStats` and four direct dependencies into a Node `vm`, then runs synthetic classified activity fixtures. No handwritten replacement of `buildSelectedStats` is accepted. Fails on missing or changed source contracts, unexpected side effects, or disagreement with **fixed independent expectations**.

The fixture contains two runs on the same day, a city-boundary crossing represented by a 3+2 km *already classified* split, overseas ADM1/ADM2 and an ADM1-only unknown ADM2, three period filters (ALL/year/month), an extra unknown case and a confirmed-zero period. Assertions cover country, prefecture, municipality, ADM1 and ADM2 distances and run counts, plus the dashboard's regions-`—` rule. Note that the boundary-intersection algorithm **itself is not exercised**—actual synthetic route/geometry intersection equivalence is a separate G2 gate.

For candidate A, the tool also reports UTF-8 byte sizes of **synthetic** serializable regional aggregates, excluding original activity identifiers and route GPS points. This is a proof-of-format probe, **not** a measurement of 1,843 real runs, not a selected production storage schema, and not approval to persist.

Remaining gates: real Safari Atlas-1 evidence (#257), source-of-truth route/geometry synthetic crossing fixtures, full-period real aggregate *capacity assessment without disclosing real data*, cache invalidation/period scope (ALL, yearly, monthly), bfcache/owner isolation and method selection after independent audit. All production connections, merging and deployment remain blocked without Atsuo's separate authorization.
