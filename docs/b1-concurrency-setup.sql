-- ONLY for the disposable GitHub Actions PostgreSQL service; NEVER production.
\ir b1-production-invalidation-isolated-fixture.sql
CREATE SCHEMA IF NOT EXISTS b1_bench;
CREATE TABLE b1_bench.runs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, distance_km numeric);
CREATE TABLE b1_bench.today_events(run_id bigint);
CREATE FUNCTION b1_bench.today_stub() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO b1_bench.today_events(run_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER today_stub AFTER INSERT ON b1_bench.runs FOR EACH ROW EXECUTE FUNCTION b1_bench.today_stub();
CREATE TRIGGER b1_invalidate AFTER INSERT ON b1_bench.runs FOR EACH STATEMENT EXECUTE FUNCTION rr_private.invalidate_region_rings_cache();
