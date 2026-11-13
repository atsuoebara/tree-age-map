/**
 * Draft UI copy contract only. Does not import or change the live index/UI.
 * Guards JA/EN parity and vocabulary from the R3/C4 agreed semantics.
 */
import copy from "../../../docs/garmin-race-analysis-ui-copy.ja-en.json" with { type: "json" };

function assert(x: unknown, message: string): asserts x {
  if (!x) throw new Error(message);
}
const strings = copy.messages as Record<string,{ja:string;en:string}>;
const required = [
  "feature_title","feature_intro","elapsed_label","elapsed_help","distance_basis",
  "sensor_intro","heart_rate","cadence","cadence_help","power","missing",
  "missing_help","partial_segment","partial_help","quality_notice",
  "optional_unavailable","optional_failure","connection_notice","privacy_notice","no_claim",
];
Deno.test("display copy contract: exactly matching Japanese and English keys",()=>{
  assert(JSON.stringify(Object.keys(strings).sort())===JSON.stringify([...required].sort()),"keys added/removed without review");
  for (const [key,word] of Object.entries(strings)) {
    assert(Object.keys(word).sort().join(",")==="en,ja",key+" has wrong locale keys");
    for(const locale of ["ja","en"] as const){
      assert(typeof word[locale]==="string" && word[locale].trim().length>0,key+" missing "+locale);
      assert(word[locale]===word[locale].trim(),key+" untrimmed "+locale);
    }
  }
});
Deno.test("display copy contract: no misleading pace, cadence, missing-data or lifecycle claims",()=>{
  const en=Object.fromEntries(Object.entries(strings).map(([k,v])=>[k,v.en]));
  assert(en.elapsed_help.includes("including stops") && en.elapsed_help.includes("not moving time"),"elapsed time caveat lost");
  assert(en.cadence_help.includes("not doubled"),"cadence no-conversion caveat lost");
  assert(en.missing_help.includes("80%") && en.missing_help.includes("not treated as zero"),"coverage caveat lost");
  assert(en.optional_failure.includes("does not affect") && en.optional_failure.includes("saving the run"),"optional failure isolation lost");
  assert(en.connection_notice.includes("loss of required permissions is confirmed"),"permission confirmation caveat lost");
  assert(en.connection_notice.includes("saved run remains"),"saved-run preservation caveat lost");
  assert(en.privacy_notice.includes("Only you"),"private read caveat lost");
  assert(en.partial_help.includes("shorter than 1 km"),"partial segment caveat lost");
});
