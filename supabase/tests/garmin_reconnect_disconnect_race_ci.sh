#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == garmin_probe_ci ]] || { echo 'Refusing non-CI database' >&2; exit 1; }
export PGOPTIONS="-c statement_timeout=10000 -c lock_timeout=8000"
P=(psql -X -qAt -v ON_ERROR_STOP=1)
q(){ "${P[@]}" -c "$1"; }
OLD=10000000-0000-0000-0000-000000000001
NEW=10000000-0000-0000-0000-000000000002
OWNER=00000000-0000-0000-0000-0000000000a1
q "create schema if not exists reconnect_race; create table reconnect_race.connections(user_id uuid primary key,connection_version uuid not null,import_enabled boolean not null,credential text not null);" >/dev/null
reset(){
 q "insert into reconnect_race.connections values('$OWNER','$OLD',true,'old') on conflict(user_id) do update set connection_version=excluded.connection_version,import_enabled=true,credential='old';" >/dev/null
}
# Proposed version-fenced disable: old disconnect may only turn off old registration.
# Two independent DB sessions, with the version boundary actively contested.
for ordering in reconnect_first disconnect_first; do
 reset
 if [[ "$ordering" == reconnect_first ]]; then
  ("${P[@]}" -c "begin; update reconnect_race.connections set connection_version='$NEW',import_enabled=true,credential='new' where user_id='$OWNER'; select pg_sleep(0.6); commit;" > /tmp/garmin_race_reconnect) &
  a=$!
  sleep 0.15
  ("${P[@]}" -c "update reconnect_race.connections set import_enabled=false where user_id='$OWNER' and connection_version='$OLD' returning connection_version;" > /tmp/garmin_race_disconnect) &
  b=$!
 else
  ("${P[@]}" -c "begin; update reconnect_race.connections set import_enabled=false where user_id='$OWNER' and connection_version='$OLD'; select pg_sleep(0.6); commit;" > /tmp/garmin_race_disconnect) &
  a=$!
  sleep 0.15
  ("${P[@]}" -c "update reconnect_race.connections set connection_version='$NEW',import_enabled=true,credential='new' where user_id='$OWNER';" > /tmp/garmin_race_reconnect) &
  b=$!
 fi
 wait "$a";wait "$b"
 q "select (connection_version='$NEW' and import_enabled and credential='new') from reconnect_race.connections where user_id='$OWNER';" | grep -qx t
 # Old worker cleanup fenced by generation can never delete the newly registered row.
 q "with removed as (delete from reconnect_race.connections where user_id='$OWNER' and connection_version='$OLD' returning user_id) select count(*) from removed;" | grep -qx 0 || {
   echo "Old worker unexpectedly deleted newer registration" >&2;exit 1;
 }
 q "select count(*) from reconnect_race.connections where user_id='$OWNER' and connection_version='$NEW' and import_enabled;" | grep -qx 1
done
# Important discovery: the current production disconnect PATCH filters ONLY on user_id.
# Demonstrate the bad sequence with a synthetic old in-flight PATCH arriving after reconnect.
reset
q "update reconnect_race.connections set connection_version='$NEW',import_enabled=true,credential='new' where user_id='$OWNER';" >/dev/null
q "update reconnect_race.connections set import_enabled=false where user_id='$OWNER';" >/dev/null
q "select (connection_version='$NEW' and import_enabled=false) from reconnect_race.connections where user_id='$OWNER';" | grep -qx t
# The proposed expected guarded operation does not damage the newly reconnected row.
q "update reconnect_race.connections set import_enabled=true where user_id='$OWNER';" >/dev/null
q "update reconnect_race.connections set import_enabled=false where user_id='$OWNER' and connection_version='$OLD';" >/dev/null
q "select (connection_version='$NEW' and import_enabled) from reconnect_race.connections where user_id='$OWNER';" | grep -qx t
q "drop schema reconnect_race cascade;" >/dev/null
rm -f /tmp/garmin_race_reconnect /tmp/garmin_race_disconnect
echo "PostgreSQL race PASS: version-fenced proposed behavior; production user-only PATCH risk reproduced (not fixed)."
