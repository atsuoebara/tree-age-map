\set ON_ERROR_STOP on
-- ONLY synthetic data. Runs on a dedicated PostgreSQL 17.6 service; no production connection.
BEGIN;
CREATE SCHEMA fixture;
CREATE TABLE fixture.runs (
 id bigint PRIMARY KEY, user_id text NOT NULL, source text NOT NULL,
 started_at timestamptz NOT NULL, activity_date date NOT NULL,
 distance_km double precision NOT NULL, route jsonb NOT NULL,
 deleted_at timestamptz
);
CREATE TABLE fixture.rings_today_run_region_distance (run_id bigint PRIMARY KEY REFERENCES fixture.runs(id) ON DELETE CASCADE,distance_km numeric(12,6));
CREATE TABLE fixture.territory_run_municipality_distance (run_id bigint PRIMARY KEY REFERENCES fixture.runs(id) ON DELETE CASCADE,distance_km numeric(12,6));
CREATE TABLE fixture.territory_run_region_distance (run_id bigint PRIMARY KEY REFERENCES fixture.runs(id) ON DELETE CASCADE,distance_km numeric(12,6));
CREATE TABLE fixture.ranking_explore_verified (run_id bigint PRIMARY KEY REFERENCES fixture.runs(id) ON DELETE CASCADE);
CREATE TABLE fixture.region_rings_refresh_state (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), is_dirty boolean NOT NULL,publication_enabled boolean NOT NULL, invalidations integer NOT NULL);
CREATE TABLE fixture.fake_pgnet_queue (run_id bigint, source text);
INSERT INTO fixture.region_rings_refresh_state VALUES(true,true,false,0);
CREATE FUNCTION fixture.invalidate_cache() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE fixture.region_rings_refresh_state SET is_dirty=true,invalidations=invalidations+1 WHERE singleton=true; RETURN null; END $$;
CREATE TRIGGER b1_runs_invalidate AFTER INSERT OR UPDATE OR DELETE ON fixture.runs FOR EACH STATEMENT EXECUTE FUNCTION fixture.invalidate_cache();
CREATE TRIGGER b1_region_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON fixture.rings_today_run_region_distance FOR EACH STATEMENT EXECUTE FUNCTION fixture.invalidate_cache();
CREATE FUNCTION fixture.enqueue_fake_live() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO fixture.fake_pgnet_queue VALUES(NEW.id,'UPDATE_OR_INSERT'); RETURN NEW; END $$;
CREATE TRIGGER trg_rings_today_live_sync AFTER INSERT OR UPDATE OF route,distance_km,activity_date,deleted_at ON fixture.runs FOR EACH ROW EXECUTE FUNCTION fixture.enqueue_fake_live();
INSERT INTO fixture.runs
SELECT n, 'test-owner','intervals',('2026-11-01T00:00:00Z'::timestamptz+(n||' days')::interval),date '2026-11-01'+n,
CASE WHEN n<9 THEN 7.000000::numeric ELSE 10.361996::numeric END,
jsonb_build_array(jsonb_build_array(0,n),jsonb_build_array(1,n),jsonb_build_array(2,n)),null
FROM generate_series(1,9) AS n;
INSERT INTO fixture.runs
SELECT n+100, 'test-owner','strava',('2026-11-01T00:00:00Z'::timestamptz+(n||' days')::interval),date '2026-11-01'+n,
CASE WHEN n<9 THEN 7.000000::numeric ELSE 9.102340::numeric END,
jsonb_build_array(jsonb_build_array(0,n),jsonb_build_array(1,n),jsonb_build_array(2,n)),null
FROM generate_series(1,9) AS n;
INSERT INTO fixture.rings_today_run_region_distance SELECT id,distance_km FROM fixture.runs;
INSERT INTO fixture.territory_run_municipality_distance SELECT id,distance_km FROM fixture.runs;
INSERT INTO fixture.ranking_explore_verified SELECT id FROM fixture.runs;
DELETE FROM fixture.fake_pgnet_queue; -- discard SETUP events only; NOT a production instruction
COMMIT;

-- Production runs.distance_km is float8; derived distances remain numeric. Hashes use whole-row JSONB.
SET TimeZone='UTC';
SET DateStyle='ISO, YMD';
SET IntervalStyle='postgres';
SET extra_float_digits=3;
CREATE TEMP TABLE frozen AS
SELECT id,source,encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') digest FROM fixture.runs r;
CREATE TEMP TABLE frozen_state AS SELECT encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') digest FROM fixture.region_rings_refresh_state s;
DO $$
BEGIN
 IF (SELECT count(*) FROM frozen)<>18 OR (SELECT count(*) FROM fixture.runs WHERE source='intervals')<>9 OR (SELECT count(*) FROM fixture.runs WHERE source='strava')<>9 THEN RAISE EXCEPTION 'baseline count'; END IF;
 IF (SELECT round(sum(distance_km)::numeric,6) FROM fixture.runs WHERE source='intervals')<>66.361996 OR (SELECT round(sum(distance_km)::numeric,6) FROM fixture.runs WHERE source='strava')<>65.102340 THEN RAISE EXCEPTION 'baseline distance'; END IF;
 IF (SELECT count(*) FROM fixture.rings_today_run_region_distance)<>18 OR (SELECT count(*) FROM fixture.territory_run_municipality_distance)<>18 OR (SELECT count(*) FROM fixture.ranking_explore_verified)<>18 OR (SELECT count(*) FROM fixture.territory_run_region_distance)<>0 THEN RAISE EXCEPTION 'baseline children'; END IF;
 IF EXISTS(SELECT 1 FROM fixture.fake_pgnet_queue) THEN RAISE EXCEPTION 'unexpected live queue'; END IF;
END $$;

-- Failure-injection subtransactions: intentionally fail, catch and prove rollback.
DO $$
DECLARE expected_failure boolean := false;
BEGIN
 BEGIN
  INSERT INTO fixture.runs VALUES (10,'test-owner','intervals','2026-11-19T00:00:00Z',date '2026-11-19',1,'[]'::jsonb,null);
  IF (SELECT count(*) FROM fixture.runs WHERE source='intervals')<>9 THEN RAISE EXCEPTION 'injected target count drift'; END IF;
 EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure OR EXISTS(SELECT 1 FROM fixture.runs WHERE id=10) THEN RAISE EXCEPTION 'count injection did not fully rollback'; END IF;
 expected_failure:=false;
 BEGIN
  UPDATE fixture.runs SET route='[[99,99]]'::jsonb WHERE id=1;
  IF (SELECT jsonb_array_length(route) FROM fixture.runs WHERE id=1)<>3 THEN RAISE EXCEPTION 'injected GPS mismatch'; END IF;
 EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure OR (SELECT jsonb_array_length(route) FROM fixture.runs WHERE id=1)<>3 THEN RAISE EXCEPTION 'GPS injection did not rollback'; END IF;
 expected_failure:=false;
 BEGIN
  DELETE FROM fixture.territory_run_municipality_distance WHERE run_id=1;
  IF (SELECT count(*) FROM fixture.territory_run_municipality_distance)<>18 THEN RAISE EXCEPTION 'injected derived drift'; END IF;
 EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure OR (SELECT count(*) FROM fixture.territory_run_municipality_distance)<>18 THEN RAISE EXCEPTION 'derived injection did not rollback'; END IF;
END $$;

-- Real PG transaction test: 9 synthetic deletes, 4 FK cascades, no DELETE→live trigger; intentionally ROLLBACK.
BEGIN;
DELETE FROM fixture.runs WHERE source='intervals' AND id BETWEEN 1 AND 9;
DO $$
BEGIN
 IF (SELECT count(*) FROM fixture.runs)<>9 OR (SELECT count(*) FROM fixture.runs WHERE source='strava')<>9 THEN RAISE EXCEPTION 'wrong delete scope'; END IF;
 IF EXISTS(SELECT 1 FROM fixture.rings_today_run_region_distance d WHERE d.run_id<100) OR EXISTS(SELECT 1 FROM fixture.territory_run_municipality_distance d WHERE d.run_id<100) OR EXISTS(SELECT 1 FROM fixture.ranking_explore_verified d WHERE d.run_id<100) THEN RAISE EXCEPTION 'cascade missed rows'; END IF;
 IF (SELECT count(*) FROM fixture.rings_today_run_region_distance)<>9 OR (SELECT count(*) FROM fixture.territory_run_municipality_distance)<>9 OR (SELECT count(*) FROM fixture.ranking_explore_verified)<>9 THEN RAISE EXCEPTION 'unexpected child counts'; END IF;
 IF EXISTS(SELECT 1 FROM fixture.fake_pgnet_queue) THEN RAISE EXCEPTION 'DELETE unexpectedly enqueued live UPDATE'; END IF;
 IF NOT (SELECT is_dirty FROM fixture.region_rings_refresh_state) OR (SELECT invalidations FROM fixture.region_rings_refresh_state)<1 THEN RAISE EXCEPTION 'cache invalidation missing'; END IF;
END $$;
ROLLBACK;

-- Assert 100% source-row and cache-state digest restoration after transaction ROLLBACK.
DO $$
BEGIN
 IF (SELECT count(*) FROM fixture.runs)<>18 OR
 (SELECT count(*) FROM fixture.rings_today_run_region_distance)<>18 OR
 (SELECT count(*) FROM fixture.territory_run_municipality_distance)<>18 OR
 (SELECT count(*) FROM fixture.ranking_explore_verified)<>18 THEN RAISE EXCEPTION 'ROLLBACK did not restore row counts'; END IF;
 IF EXISTS(
  SELECT 1 FROM frozen f FULL JOIN (SELECT id,source,encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') digest FROM fixture.runs r) a USING(id)
  WHERE f.id IS NULL OR a.id IS NULL OR f.source IS DISTINCT FROM a.source OR f.digest IS DISTINCT FROM a.digest
 ) THEN RAISE EXCEPTION 'ROLLBACK did not restore full source hashes'; END IF;
 IF (SELECT digest FROM frozen_state) IS DISTINCT FROM
 (SELECT encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') FROM fixture.region_rings_refresh_state s)
 THEN RAISE EXCEPTION 'cache rollback hash mismatch'; END IF;
 RAISE NOTICE 'PASS: PG17.6 synthetic injection/transaction/cascade/cache/rollback full-row hashes';
END $$;

-- float8 source-type serialization restoration simulation, with deliberately tricky binary values.
CREATE TEMP TABLE float8_probe (id bigint PRIMARY KEY, km double precision, center_lat double precision, center_lng double precision);
INSERT INTO float8_probe VALUES
(1,0.1::double precision,36.123456789123456::double precision,139.98765432112345::double precision),
(2,66.361996::double precision,(-0.00000000000001)::double precision,1.0000000000000002::double precision),
(3,65.102340::double precision,89.99999999999999::double precision,(-179.99999999999997)::double precision);
CREATE TEMP TABLE float8_frozen AS SELECT id,
encode(float8send(km),'hex') km_bytes,
encode(float8send(center_lat),'hex') lat_bytes,
encode(float8send(center_lng),'hex') lng_bytes,
encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex') digest
FROM float8_probe f;
-- Serialize to PostgreSQL textual float8 representation, then restore using exact float8 cast in an isolated temp table.
CREATE TEMP TABLE float8_restored AS SELECT id,km::text::double precision km,
center_lat::text::double precision center_lat,center_lng::text::double precision center_lng FROM float8_probe;
DO $$
BEGIN
 IF current_setting('server_version_num')::integer / 10000 <> 17 THEN RAISE EXCEPTION 'wrong postgres major'; END IF;
 IF (SELECT count(*) FROM float8_probe)<>3 OR (SELECT count(*) FROM float8_restored)<>3 THEN RAISE EXCEPTION 'float8 probe count'; END IF;
 IF EXISTS(
  SELECT 1 FROM float8_frozen x FULL JOIN
   (SELECT id,encode(float8send(km),'hex') km_bytes,
    encode(float8send(center_lat),'hex') lat_bytes,
    encode(float8send(center_lng),'hex') lng_bytes,
    encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex') digest FROM float8_restored r) y USING(id)
   WHERE x.id IS NULL OR y.id IS NULL
   OR x.km_bytes IS DISTINCT FROM y.km_bytes
   OR x.lat_bytes IS DISTINCT FROM y.lat_bytes
   OR x.lng_bytes IS DISTINCT FROM y.lng_bytes
   OR x.digest IS DISTINCT FROM y.digest
 ) THEN RAISE EXCEPTION 'float8 text restore altered binary or row SHA256'; END IF;
 RAISE NOTICE 'PASS: float8 text restore exact binary values and full-row SHA256';
END $$;
