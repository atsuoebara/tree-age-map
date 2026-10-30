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
CREATE ROLE b1_test_approver LOGIN INHERIT;
CREATE ROLE b1_test_publisher LOGIN INHERIT;
GRANT b1_approver TO b1_test_approver;
GRANT b1_publisher TO b1_test_publisher;
-- Positive EXECUTE via dedicated login, without changing session_user.
SET SESSION AUTHORIZATION b1_test_approver;
DO $$
BEGIN
 IF NOT has_function_privilege(current_user,'rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'approver wrapper permission absent'; END IF;
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_start()','EXECUTE')
 THEN RAISE EXCEPTION 'approver can start'; END IF;
 IF has_table_privilege(current_user,'rr_private.region_rings_approved_year','SELECT')
 THEN RAISE EXCEPTION 'approver can read table'; END IF;
END $$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_APPROVER_SCOPE_PASS'
SET SESSION AUTHORIZATION b1_test_publisher;
DO $$
BEGIN
 IF NOT has_function_privilege(current_user,'rr_private.b1_wrapped_start()','EXECUTE')
 THEN RAISE EXCEPTION 'publisher wrapper permission absent'; END IF;
 IF has_function_privilege(current_user,'rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'publisher can approve'; END IF;
END $$;
RESET SESSION AUTHORIZATION;
\echo 'B1_WRAPPER_PUBLISHER_SCOPE_PASS'
-- Role escalation test: a member of two roles must fail closed even when
-- the session has EXECUTE privilege on the selected wrapper.
GRANT b1_publisher TO b1_test_approver;
SET SESSION AUTHORIZATION b1_test_approver;
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
REVOKE b1_publisher FROM b1_test_approver;
REVOKE b1_approver FROM b1_test_approver;
DO $$
BEGIN
 IF has_function_privilege('b1_test_approver','rr_private.b1_wrapped_approve(text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'revoked approver still has execute'; END IF;
END $$;
\echo 'B1_WRAPPER_REVOKE_PASS'
