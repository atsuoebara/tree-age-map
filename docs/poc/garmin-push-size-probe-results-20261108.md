# Garmin Push synthetic size probe — 2026-11-08

**Executed locally, no live Garmin or Supabase writes.** Reproduce with `python3 docs/poc/garmin_push_payload_probe.py`.

- Samples: 12,561
- JSON size: **3,090,649 bytes** (3.09 MB decimal)
- Current receiver 8,000,000-byte guard: **below limit** for this ONE representative synthetic structure
- Local Python JSON construction: **0.442 seconds**
- Python tracemalloc peak: **11,464,472 bytes**
- The payload includes timestamp, cumulative distance, GPS, heart rate, cadence, power, speed and elevation.

## Caveats (blocking M6)
- This is not a real Garmin Push; real activities can have different sample counts and JSON sizes.
- Python peak heap isn't Deno/Supabase runtime memory and does not include all system allocations.
- No HTTP ACK, queue, worker, retry or permission integration was tested.
- No production rollout is authorized by this result.

Local TCX 1km PoC: 7/7 tests passed in 0.518 seconds when run from `/mnt/data`; its full test source and result JSON have **not yet been added** to this PR, and the PR should not claim those as independently reproducible evidence.
