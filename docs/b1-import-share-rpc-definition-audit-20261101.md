# B-1 RPC function definition audit evidence

Source: read-only `pg_get_functiondef` inspection of `public.get_import_share_origin_page` on 2026-11-01, transcribed and whitespace normalized. This file contains a database function definition only, not personal records. Auditors should compare against current deployed definition independently. Not a migration and must not be executed.

```sql
CREATE OR REPLACE FUNCTION public.get_import_share_origin_page(p_after_id text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with page_ids as materialized (
    select r.id
    from public.runs r
    where r.deleted_at is null
      and (p_after_id is null or (r.id::text collate "C") > (p_after_id collate "C"))
    order by r.id::text collate "C"
    limit greatest(1, least(coalesce(p_limit, 500), 500))
  ), first_points as materialized (
    select r.id::text as run_id, r.source, r.name, r.distance_km,
      r.route -> 0 as point
    from page_ids p
    join public.runs r on r.id = p.id
  ), page_rows as (
    select run_id, source, name, distance_km,
      case when (point ->> 0) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        and length(point ->> 0) <= 40
        then (point ->> 0)::double precision else null end as lat,
      case when (point ->> 1) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        and length(point ->> 1) <= 40
        then (point ->> 1)::double precision else null end as lng
    from first_points
  )
  select jsonb_build_object(
    'rows', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.run_id collate "C") from page_rows p),
      '[]'::jsonb
    ),
    'total_rows', case when p_after_id is null
      then (select count(*) from public.runs where deleted_at is null)
      else null end
  );
$function$;
```

This function filters `deleted_at IS NULL`, limits to 500 run IDs ordered with `C` collation, and does not filter by year, consent, or source. It does not deduplicate different IDs containing the same activity. `total_rows` is populated only when `p_after_id IS NULL`. No production settings were changed.
