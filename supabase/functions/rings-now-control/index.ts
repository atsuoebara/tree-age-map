// Draft Supabase Edge Function entrypoint; NOT deployed.
// Import is local so deployment, if separately approved, can bundle its contract.
import {handleRingsNowControl} from './contract.mjs';

// No Supabase client, credentials, logging, KV, storage, cookies or external calls.
// Any later enabling of CORS or enabled=true requires a separate audited PR.
Deno.serve(handleRingsNowControl);
