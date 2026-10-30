-- Synthetic isolated PostgreSQL test fixture. NEVER run against production.
\set ON_ERROR_STOP on
CREATE SCHEMA b1_gate_test;
CREATE TABLE b1_gate_test.state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 enabled boolean NOT NULL DEFAULT false,
 dirty boolean NOT NULL DEFAULT false,
 policy_version text NOT NULL DEFAULT 'v1',
 generation bigint NOT NULL DEFAULT 1
);
INSERT INTO b1_gate_test.state(singleton) VALUES(true);
CREATE TABLE b1_gate_test.snapshot (
 country text NOT NULL, year int NOT NULL,
 distance_km numeric NOT NULL, generation bigint NOT NULL,
 policy_version text NOT NULL, approved boolean NOT NULL DEFAULT false,
 PRIMARY KEY(country,year)
);
INSERT INTO b1_gate_test.snapshot VALUES ('JP',2026,1200,1,'v1',true);
-- Deliberately locks the state row FOR SHARE so withdrawal cannot commit
-- while a checked value is still being read within this transaction.
CREATE FUNCTION b1_gate_test.read_value(p_country text,p_year int)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE s b1_gate_test.state%ROWTYPE; v numeric;
BEGIN
 SELECT * INTO s FROM b1_gate_test.state WHERE singleton FOR SHARE;
 IF NOT FOUND OR NOT s.enabled OR s.dirty THEN RETURN NULL; END IF;
 SELECT distance_km INTO v FROM b1_gate_test.snapshot
 WHERE country=p_country AND year=p_year AND approved
   AND generation=s.generation AND policy_version=s.policy_version;
 RETURN v;
END $$;
CREATE FUNCTION b1_gate_test.withdraw()
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE next_generation bigint;
BEGIN
 UPDATE b1_gate_test.state
 SET enabled=false, dirty=true, generation=generation+1
 WHERE singleton RETURNING generation INTO next_generation;
 RETURN next_generation;
END $$;
-- Baseline fail-closed, then test approval and stale snapshots.
DO $$
BEGIN
 IF b1_gate_test.read_value('JP',2026) IS NOT NULL THEN RAISE EXCEPTION 'OFF leaked'; END IF;
 UPDATE b1_gate_test.state SET enabled=true;
 IF b1_gate_test.read_value('JP',2026) <> 1200 THEN RAISE EXCEPTION 'valid value unavailable'; END IF;
 UPDATE b1_gate_test.state SET dirty=true;
 IF b1_gate_test.read_value('JP',2026) IS NOT NULL THEN RAISE EXCEPTION 'dirty leaked'; END IF;
 UPDATE b1_gate_test.state SET dirty=false, policy_version='v2';
 IF b1_gate_test.read_value('JP',2026) IS NOT NULL THEN RAISE EXCEPTION 'policy mismatch leaked'; END IF;
 UPDATE b1_gate_test.state SET policy_version='v1';
 IF b1_gate_test.read_value('JP',2026) <> 1200 THEN RAISE EXCEPTION 'reset failed'; END IF;
END $$;
SELECT 'B1_GATE_FIXTURE_READY' AS check;
