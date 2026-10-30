-- B-1 repeatability benchmark: synthetic data ONLY, disposable PostgreSQL service.
-- Never use against production. Today is a LOCAL event-logging stub, not HTTP/pg_net.
BEGIN;
\ir b1-production-invalidation-isolated-fixture.sql
CREATE TEMP TABLE b1_runs (id bigint GENERATED ALWAYS AS IDENTITY, distance_km numeric);
CREATE TEMP TABLE b1_events (run_id bigint);
CREATE TEMP TABLE b1_results (mode text, b1_enabled boolean, trial int, elapsed_ms numeric, event_count int);
CREATE FUNCTION pg_temp.b1_today_stub() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN INSERT INTO b1_events VALUES (NEW.id); RETURN NEW; END $fn$;
CREATE TRIGGER b1_today AFTER INSERT ON b1_runs FOR EACH ROW EXECUTE FUNCTION pg_temp.b1_today_stub();
CREATE TRIGGER b1_invalidate AFTER INSERT ON b1_runs FOR EACH STATEMENT EXECUTE FUNCTION rr_private.invalidate_region_rings_cache();

DO $benchmark$
DECLARE
  trial_no integer;
  phase integer;
  use_b1 boolean;
  how text;
  j integer;
  started timestamptz;
  elapsed numeric;
  actual_events integer;
BEGIN
  FOR how IN SELECT unnest(ARRAY['batch100','single100']) LOOP
    FOR trial_no IN 1..12 LOOP
      FOR phase IN 1..2 LOOP
        -- Alternate order between trials to reduce cache/warmup bias.
        use_b1 := (phase = 1 AND trial_no % 2 = 1) OR (phase = 2 AND trial_no % 2 = 0);
        IF use_b1 THEN
          ALTER TABLE b1_runs ENABLE TRIGGER b1_invalidate;
        ELSE
          ALTER TABLE b1_runs DISABLE TRIGGER b1_invalidate;
        END IF;
        TRUNCATE b1_runs, b1_events;
        UPDATE rr_private.region_rings_refresh_state SET is_dirty = false WHERE singleton = true;
        started := clock_timestamp();
        IF how = 'batch100' THEN
          INSERT INTO b1_runs(distance_km) SELECT 5 FROM generate_series(1,100);
        ELSE
          FOR j IN 1..100 LOOP
            INSERT INTO b1_runs(distance_km) VALUES(5);
          END LOOP;
        END IF;
        elapsed := extract(epoch FROM clock_timestamp() - started) * 1000;
        SELECT count(*) INTO actual_events FROM b1_events;
        IF actual_events <> 100 THEN
          RAISE EXCEPTION 'Today event count mismatch: %, trial %, B1 %', actual_events, trial_no, use_b1;
        END IF;
        INSERT INTO b1_results VALUES (how, use_b1, trial_no, elapsed, actual_events);
      END LOOP;
    END LOOP;
  END LOOP;
END $benchmark$;

SELECT mode, b1_enabled, count(*) AS trials,
 round(avg(elapsed_ms),3) AS avg_ms,
 round(percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms)::numeric,3) AS median_ms,
 round(percentile_cont(0.95) WITHIN GROUP (ORDER BY elapsed_ms)::numeric,3) AS p95_ms,
 round(max(elapsed_ms),3) AS max_ms,
 min(event_count) AS min_today_events,
 max(event_count) AS max_today_events
FROM b1_results GROUP BY mode,b1_enabled ORDER BY mode,b1_enabled;
ROLLBACK;
