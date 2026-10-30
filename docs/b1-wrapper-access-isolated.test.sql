-- B-1 isolation only: execute using a disposable PostgreSQL instance.
\set ON_ERROR_STOP on
\i docs/b1-private-gate-ledger-isolated.test.sql
\i docs/b1-wrapper-isolation-prototype-20261030.sql
-- Verify PUBLIC/anon/authenticated do not reach the wrapper.
DO $$
DECLARE sig text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'rr_private.b1_wrapped_approve(text,integer)',
 'rr_private.b1_wrapped_start()',
 'rr_private.b1_wrapped_stop(text)',
 'rr_private.b1_wrapped_read(text,integer)'] LOOP
  IF has_function_privilege('anon',sig,'EXECUTE')
    OR has_function_privilege('authenticated',sig,'EXECUTE')
  THEN RAISE EXCEPTION 'unexpected public EXECUTE: %',sig; END IF;
 END LOOP;
 IF has_table_privilege('b1_approver','rr_private.region_rings_approved_year','SELECT')
    OR has_table_privilege('b1_publisher','rr_private.region_rings_publication_state','UPDATE')
 THEN RAISE EXCEPTION 'operator has direct table privilege'; END IF;
END $$;
\echo 'B1_WRAPPER_PUBLIC_DENY_PASS'
CREATE ROLE isolated_alice LOGIN INHERIT;
CREATE ROLE isolated_bob LOGIN INHERIT;
GRANT b1_approver TO isolated_alice;
GRANT b1_publisher TO isolated_bob;
-- Positive EXECUTE via dedicated login, without changing session_user.
SET SESSION AUTHORIZATION isolated_alice;
DO $$
BEGIN
 IF NOT has_function_privilege(current_user,'rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'approver wrapper permission absent'; END IF;
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_start()','EXECUTE')
 THEN RAISE EXCEPTION 'approver can start'; END IF;
 IF has_table_privilege(current_user,'rr_private.region_rings_approved_year','SELECT')
 THEN RAISE EXCEPTION 'approver can read table'; END IF;
END $$;
DO $$ BEGIN IF rr_private.b1_wrapped_approve('JP',2023) THEN RAISE EXCEPTION 'unexpected approval'; END IF; END $$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_APPROVER_SCOPE_PASS'
SET SESSION AUTHORIZATION isolated_bob;
DO $$
BEGIN
 IF NOT has_function_privilege(current_user,'rr_private.b1_wrapped_start()','EXECUTE')
 THEN RAISE EXCEPTION 'publisher wrapper permission absent'; END IF;
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'publisher can approve'; END IF;
END $$;
DO $$ BEGIN IF rr_private.b1_wrapped_start() THEN RAISE EXCEPTION 'unexpected start'; END IF; END $$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_PUBLISHER_SCOPE_PASS'
-- Role escalation test: a member of two roles must fail closed even when
-- the session has EXECUTE privilege on the selected wrapper.
GRANT b1_publisher TO isolated_alice;
SET SESSION AUTHORIZATION isolated_alice;
DO $$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM rr_private.b1_wrapped_approve('JP',2023);
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'multi-role actor was accepted'; END IF;
END $$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_MULTIPLE_ROLES_DENIED_PASS'
REVOKE b1_publisher FROM isolated_alice;
REVOKE b1_approver FROM isolated_alice;
DO $$
BEGIN
 IF has_function_privilege('isolated_alice','rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'revoked approver still has execute'; END IF;
END $$;
\echo 'B1_WRAPPER_REVOKE_PASS'


-- Exercise emergency-stop and private-read entry points through individual identities.
CREATE ROLE isolated_carol LOGIN INHERIT;
CREATE ROLE isolated_dan LOGIN INHERIT;
GRANT b1_emergency_stopper TO isolated_carol;
GRANT b1_private_reader TO isolated_dan;
SET SESSION AUTHORIZATION isolated_carol;
DO $b1_stop_wrapper$
DECLARE gen bigint;
BEGIN
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_start()','EXECUTE')
 THEN RAISE EXCEPTION 'stopper can start'; END IF;
 IF has_table_privilege(current_user,'rr_private.region_rings_publication_state','UPDATE')
 THEN RAISE EXCEPTION 'stopper can update state directly'; END IF;
 gen:=rr_private.b1_wrapped_stop('isolated emergency stop test');
 IF gen IS NULL THEN RAISE EXCEPTION 'stop wrapper returned NULL'; END IF;
END $b1_stop_wrapper$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_STOP_EXECUTED_PASS'
SET SESSION AUTHORIZATION isolated_dan;
DO $b1_read_wrapper$
BEGIN
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'reader can approve'; END IF;
 IF has_table_privilege(current_user,'rr_private.region_rings_approved_year','SELECT')
 THEN RAISE EXCEPTION 'reader can read snapshots directly'; END IF;
 IF EXISTS(SELECT 1 FROM rr_private.b1_wrapped_read('JP',2023))
 THEN RAISE EXCEPTION 'private reader leaked stopped publication'; END IF;
END $b1_read_wrapper$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_READ_EXECUTED_PASS'


-- Negative execution tests use dedicated active principals, not previously revoked accounts.
CREATE ROLE isolated_eve LOGIN INHERIT;
CREATE ROLE isolated_frank LOGIN INHERIT;
GRANT b1_approver TO isolated_eve;
GRANT b1_emergency_stopper TO isolated_frank;
SET SESSION AUTHORIZATION isolated_eve;
DO $b1_cross_role$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM rr_private.b1_wrapped_start();
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'approver invoked publisher entry'; END IF;
 denied:=false;
 BEGIN PERFORM rr_private.b1_wrapped_approve('INVALID',2023);
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'invalid country accepted'; END IF;
END $b1_cross_role$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_CROSS_ROLE_DENIED_PASS'
SET SESSION AUTHORIZATION isolated_frank;
DO $b1_cross_stop$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM rr_private.b1_wrapped_read('JP',2023);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'stopper invoked private reader entry'; END IF;
 denied:=false;
 BEGIN PERFORM rr_private.b1_wrapped_stop('short');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'short reason accepted'; END IF;
END $b1_cross_stop$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_STOP_INPUT_DENIED_PASS'
REVOKE b1_emergency_stopper FROM isolated_carol;
REVOKE b1_private_reader FROM isolated_dan;
DO $b1_revoke_all$
BEGIN
 IF has_function_privilege('isolated_carol','rr_private.b1_wrapped_stop(text)','EXECUTE')
 OR has_function_privilege('isolated_dan','rr_private.b1_wrapped_read(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'revocation failed for stopper or reader'; END IF;
END $b1_revoke_all$;
\echo 'B1_WRAPPER_ALL_REVOKED_PASS'
