# Issue #205 — independent monthly ranking / review gate
Date: 2026-11-17. Status: **candidate only — NOT APPLIED**.

## Existing state
- `ranking.html` already offers year/month selection, but the three `ranking_*_monthly` RPCs sort by annual totals and append monthly increments.
- `supabase/ranking-monthly.sql` must remain unchanged; annual ranks, visibility and existing columns cannot regress.
- The new `supabase/ranking-month-places.sql` defines three separate RPC candidates; no migration, data change, activation or public UI has occurred.

## Defined semantics
- DISTANCE: rank only users with >0km valid saved runs on the selected calendar month by aggregated distance. Rank uses private underlying totals; amount disclosed only with `join_distance`. Display name / flag independently gated. Stable order by user_id for ties; 100 top users selected *after* monthly ordering.
- EXPLORE: rank users gaining >=1 new verified region **for the selected year** in that month, using earliest non-deleted associated activity date; repeated visits don't count again within year. Only verified regions, country filtered. Disclose count only with `join_explore`; region names require `show_regions` **and** `join_explore`. No GPS traces.
- NATIONS: countries with consenting `join_nations` runners who have valid activity in that month. Monthly km only. Country code must be two uppercase ASCII letters. Count is participants *with a monthly run*.
- Empty month returns no ranks; year/month must be valid inputs (UI must reject future or invalid selections). Date is saved `activity_date`, no timestamp timezone conversion.
- Annual and historical monthly-additions views remain available unchanged; UI switch will need new read-only RPC names and separate cache keys before activation.

## Required independent checks BEFORE any Supabase application
1. Test the SQL candidate in isolated disposable DB with actual schema and grants; verify signatures, syntax, and no mutation of existing RPCs.
2. DISTANCE: two users with annual order opposite monthly order; annual top-100 exclusion must not hide monthly top runners; ties; hidden monthly km; no runs/zero/negative/deleted entries.
3. EXPLORE: earliest valid region date within year, multiple runs same region, region count consent and names gated, reversed annual/month ordering; deleted first-visit scenarios; zero new regions.
4. NATIONS: `join_nations` true/false, no runs in month, participant counts, country changes, ordering ties, and explicit comparison with annual nation semantics.
5. Check `anon` and `authenticated` grants; users must never see user UUID, source activity, GPS or private counts; `service_role` remains privileged; function owner & security definer review.
6. Invalid month inputs 0/13 and unreasonable years: define caller-side and DB-side validation before acceptance.
7. Privacy regression: anonymous user can infer relative ordering from ranks (already existing annual design), but cannot see unshared numbers.
8. Check response size and DB query plan; 375px iPhone view; language, share image, filter and rapid switch race conditions once UI is added.

## HOLD
Do not apply candidate SQL to live Supabase, merge into main, deploy, or enable UI until independent Muse audit and Atsuo's specific approval. No change to `今を知ろう` / PR #109 HOLD.
