// REVIEW-ONLY / pure synthetic contract. Not connected to Strava, Garmin,
// COROS, Connect IQ, production runs, or network calls.
// Keep the Strava-imported run as the canonical run when it already exists.
// Never merge details across sources based solely on day/distance.
const SOURCES = new Set(['strava','garmin-api','garmin-iq','coros','fit','tcx','gpx']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function decideRaceDetailAttachment({ownerId, selectedRun, candidates = [], privateView = false, explicitConsent = false} = {}) {
 const blocked = reason => ({status:'blocked',reason,canonicalRunId:null,detailsSource:null,writeAllowed:false});
 if(typeof ownerId !== 'string'||!ownerId||!selectedRun||selectedRun.ownerId!==ownerId||!privateView)
   return blocked('owner_or_private_view_not_verified');
 if(!Number.isSafeInteger(selectedRun.id)||selectedRun.id<=0||!SOURCES.has(selectedRun.source))
   return blocked('unsupported_run');
 if(!explicitConsent)return blocked('explicit_detail_consent_required');
 if(!Array.isArray(candidates)||candidates.length>100)return blocked('invalid_candidates');
 if(!finite(selectedRun.startedMs)||!finite(selectedRun.distanceM)||selectedRun.distanceM<=0)
   return blocked('canonical_metadata_incomplete');
 // A run sourced from Strava remains the canonical saved run. We do not
 // import a second run, rewrite its source, or combine uncertain sensors.
 const eligible = [];
 for(const c of candidates) {
  if(!c||c.ownerId!==ownerId||!SOURCES.has(c.source))continue;
  if(c.source==='gpx'||c.source==='garmin-iq')continue; // no proven per-sample basis
  if(!finite(c.startedMs)||!finite(c.distanceM)||c.distanceM<=0)continue;
  const deltaMs=Math.abs(c.startedMs-selectedRun.startedMs);
  const deltaM=Math.abs(c.distanceM-selectedRun.distanceM);
  if(deltaMs>120000||deltaM>Math.max(100,selectedRun.distanceM*0.03))continue;
  if(c.activityKind!=='running'||c.hasDistanceTimeSamples!==true)continue;
  if(c.source==='strava'&&c.externalActivityId!==selectedRun.externalActivityId)continue;
  eligible.push(c);
 }
 const sourceSet = new Set(eligible.map(c=>c.source+':'+String(c.externalActivityId??'')));
 if(eligible.length!==1||sourceSet.size!==1)
  return {status:'needs_review',reason:eligible.length===0?'no_confirmed_detail_candidate':'ambiguous_multi_source_match',canonicalRunId:selectedRun.id,detailsSource:null,writeAllowed:false};
 const candidate=eligible[0];
 // Match confidence is only a gate to propose review; matching by time and
 // distance cannot establish identity when multiple workouts overlap.
 return {status:'review_candidate',reason:'user_must_confirm_activity_identity_and_permissions',
  canonicalRunId:selectedRun.id,detailsSource:candidate.source,writeAllowed:false,
  samplesPermittedForPreview:false};
}
