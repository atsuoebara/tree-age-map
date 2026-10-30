-- ONLY for the disposable GitHub Actions PostgreSQL service; NEVER production.
CREATE SCHEMA IF NOT EXISTS b1_bench;
CREATE TABLE b1_bench.runs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, distance_km numeric);
CREATE TABLE b1_bench.today_events(run_id bigint);
CREATE TABLE b1_bench.candidates(id int);
CREATE TABLE b1_bench.refresh_state(id int PRIMARY KEY, is_dirty boolean NOT NULL DEFAULT false);
INSERT INTO b1_bench.refresh_state VALUES(1,false);
CREATE FUNCTION b1_bench.today_stub() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO b1_bench.today_events(run_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE FUNCTION b1_bench.invalidate_stub() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM b1_bench.candidates; UPDATE b1_bench.refresh_state SET is_dirty=true WHERE id=1; RETURN NULL; END $$;
CREATE TRIGGER today_stub AFTER INSERT ON b1_bench.runs FOR EACH ROW EXECUTE FUNCTION b1_bench.today_stub();
CREATE TRIGGER b1_invalidate AFTER INSERT ON b1_bench.runs FOR EACH STATEMENT EXECUTE FUNCTION b1_bench.invalidate_stub();
