// REVIEW-ONLY in-memory proposal: never writes or imports the production OAuth endpoint.
// Requires an exact source anchor so a future source edit cannot silently alter the test.
export function makeFencedDisconnectCandidate(source) {
  const old = "const rows = await json(`${db}?user_id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', headers: { ...adminHeaders(c), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ import_enabled: false, permissions_retry_at: new Date().toISOString() }) });";
  if (source.split(old).length !== 2) throw Error('source drift: disconnect anchor must appear exactly once');
  const replacement = `// Candidate: read a registration generation, then PATCH only that generation.
          // Reconnect after the read must make the old disable a no-op.
          const prior = await json(\`\${db}?user_id=eq.\${encodeURIComponent(account.id)}&select=connection_version\`, { headers: adminHeaders(c) });
          const generation = prior[0]?.connection_version;
          if (!generation) return respond('',303,{...clear,Location:\`\${ORIGIN}/?garmin=disconnected\`});
          const rows = await json(\`\${db}?user_id=eq.\${encodeURIComponent(account.id)}&connection_version=eq.\${encodeURIComponent(generation)}\`, { method: 'PATCH', headers: { ...adminHeaders(c), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ import_enabled: false, permissions_retry_at: new Date().toISOString() }) });
          // A new generation won the race. Never revoke a new connection's credentials.
          if (!rows.length) return respond('',303,{...clear,Location:\`\${ORIGIN}/?garmin=connected\`});`;
  return source.replace(old,replacement);
}
