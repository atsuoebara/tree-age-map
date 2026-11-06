# runs RLS insert observation

Checked 2026-11-06. The RLS-remediation migration has version `20261106030727`. One Strava-origin run was created on Nov 6 before the migration, but no `runs` rows had `created_at` later than `2026-11-06 03:07:27+00` when checked.

This does not prove that post-remediation INSERT or synchronization works. No running records or permissions were changed in this check. Final acceptance still requires normal authenticated import, Strava sync, and file import tests. A post-migration `source=strava` row alone would not prove a successful full sync without accompanying workflow evidence.
