# R1/C6 performance evidence — 2026-11-09 (draft)

PR #67, **review-only**. No production receiver, database, deploy or Garmin credentials changed.

## R1 observed synthetic byte limit
Previously added Deno R1 batch fixture `supabase/functions/_shared/garmin_race_batch_probe_test.ts` measured 12,561 samples per synthetic activity:
- 1 activity: raw 3,065,490 bytes; GPS-only 799,346 bytes.
- 2 activities: raw 6,130,959 bytes; GPS-only 1,598,671 bytes.
- 3 activities: raw 9,196,428 bytes; GPS-only 2,397,996 bytes.
- Receiver's **raw HTTP request guard is 8,000,000 bytes**, evaluated BEFORE JSON parsing and any optional-analysis fallback. Three-activity synthetic batch exceeds the guard and would be rejected as a whole, not degrade to GPS-only.

These figures are **not actual Garmin notification measurements**, and represent one chosen synthetic sample density and field set. Real event batches, cadence, extra fields and encoding can vary.

### R1 decision needed
Do NOT simply raise raw HTTP limit; existing 8MB bound protects resources and already precedes parse. Do not claim GPS-first fallback can rescue a body that the receiver never parses. Before enabling:
1. Measure real provider event counts/body byte sizes safely (without leaking athlete data, tokens or raw payload to CI logs).
2. Decide provider retry/acknowledgement semantics and 413 policy for large multi-activity push batches.
3. Test 8MB edge, oversize raw rejection, and that optional analysis failure never affects accepted GPS imports.
4. If considering streaming/size-guard changes, design and independently audit bounded memory and body handling **in a separate PR**; no implied production behavior change.

## C6 isolated workload
`supabase/functions/_shared/garmin_race_load_probe_test.ts` exercises the actual isolated sensor preview + 1km summary computation at 12,561 and 20,000 synthetic samples. Reports raw JSON bytes, parse time, averaged preview + summary compute times and sampled Deno heap bytes. 20,001 samples must return `too_many_samples`. CI runner measurements are exploratory, not Supabase Edge worker latency or memory guarantees.

## C6 measured synthetic Deno results

GitHub Actions #42567789805, **rerun successful** after the first attempt hit GitHub Deno release download HTTP 504 before code execution. Deno check and tests succeeded: **28 passed, 0 failed**.

| Synthetic activity | JSON raw bytes | JSON parse | Preview avg | Summary avg | Combined avg | Sampled Deno heap |
|---|---:|---:|---:|---:|---:|---:|
| 12,561 samples, 3 iterations | 3,065,488 | 3.856 ms | 2.611 ms | 15.041 ms | 17.653 ms | 100,337,928 B |
| 20,000 samples, 2 iterations | 4,881,196 | 6.120 ms | 4.045 ms | 14.315 ms | 18.360 ms | 122,782,416 B |

Both produce **43 distance segments** for the synthetic 42.397 km route. The optional preview uses 1,650,656 B (12,561 samples) and 2,628,554 B (20,000 samples), under the 5MB optional cap. A 20,001-sample input is rejected with `too_many_samples`.

**Caveats:** JSON parse is timed separately, so combined average excludes parse. Memory figures are sampled `heapUsed` snapshots, **not actual peak RSS or proof of staying within an Edge worker memory limit**. CPU measurements vary with shared CI hardware and are not an endpoint's HTTP ACK/DB latency. No receiver wire-up, no real Garmin payload data.

## Acceptance boundaries
CPU/RAM of actual Supabase Edge Function, HTTP request handling, response acknowledgement deadline, DB RPC latency, provider retries, and realistic Garmin payloads remain unmeasured. No implementation gate R1/C6 is declared complete by synthetic Deno benchmarks alone.
