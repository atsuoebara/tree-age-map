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

## Acceptance boundaries
CPU/RAM of actual Supabase Edge Function, HTTP request handling, response acknowledgement deadline, DB RPC latency, provider retries, and realistic Garmin payloads remain unmeasured. No implementation gate R1/C6 is declared complete by synthetic Deno benchmarks alone.
