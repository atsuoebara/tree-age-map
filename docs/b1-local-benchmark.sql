-- B-1 synthetic-only PostgreSQL performance harness.
-- Run ONLY in a disposable local PostgreSQL database, never production.
-- psql -v ON_ERROR_STOP=1 -f docs/b1-local-benchmark.sql
BEGIN;
CREATE TEMP TABLE bench_runs(id bigint generated always as identity, distance_km numeric);
CREATE TEMP TABLE bench_events(run_id bigint);
CREATE TEMP TABLE bench_candidate(id int);
CREATE TEMP TABLE bench_state(dirty boolean);
INSERT INTO bench_state VALUES(false);
CREATE FUNCTION pg_temp.bench_today() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO bench_events(run_id) VALUES (NEW.id); RETURN NEW; END $$;
CREATE FUNCTION pg_temp.bench_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM bench_candidate; UPDATE bench_state SET dirty=true; RETURN NULL; END $$;
CREATE TRIGGER bench_today AFTER INSERT ON bench_runs FOR EACH ROW EXECUTE FUNCTION pg_temp.bench_today();
CREATE TRIGGER bench_b1 AFTER INSERT ON bench_runs FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.bench_invalidate();
-- Compare identical statements, toggling ONLY B-1. The row-level Today stand-in stays enabled.
EXPLAIN (ANALYZE, BUFFERS) INSERT INTO bench_runs(distance_km) SELECT 5 FROM generate_series(1,100);
SELECT count(*) AS today_events_with_b1 FROM bench_events;
TRUNCATE bench_runs, bench_events;
ALTER TABLE bench_runs DISABLE TRIGGER bench_b1;
EXPLAIN (ANALYZE, BUFFERS) INSERT INTO bench_runs(distance_km) SELECT 5 FROM generate_series(1,100);
SELECT count(*) AS today_events_without_b1 FROM bench_events;
ROLLBACK;
-- NOTE: This harness approximates local queueing, NOT pg_net HTTP overhead, concurrency or p95.
