'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const page=fs.readFileSync('ranking.html','utf8');
const sql=fs.readFileSync('supabase/ranking-nations-month-suppress-candidate.sql','utf8');
let n=0;
const check=(name,fn)=>{fn();n++;console.log('PASS',name)};
check('NATIONS month explicitly hidden in Japanese and English',()=>{assert.match(page,/NATIONS の月間増加分はプライバシー保護のため一時非表示/);assert.match(page,/NATIONS monthly additions are temporarily hidden/);});
check('NATIONS rendering never creates monthly score cell',()=>assert.match(page,/if\(kind==='nations'\)\{node\.dataset\.search=.*?return;\}[\s\S]*?const monthly=document\.createElement/));
check('NATIONS result sanitized before DOM and cache writes',()=>{assert.match(page,/n\.data\.map\(r=>\(\{\.\.\.r,month_km:null\}\)\)/);assert.match(page,/cachedNations\.map\(r=>\(\{\.\.\.r,month_km:null\}\)\)/);});
check('old NATIONS month cache invalidated',()=>assert.match(page,/startsWith\(rankingCachePrefix\+'nations:'\)/));
check('SQL maintains old signature and grants but sets month_km null',()=>{assert.match(sql,/CREATE OR REPLACE FUNCTION public\.ranking_nations_monthly\(p_year integer, p_month integer\)/);assert.match(sql,/RETURNS TABLE\(place bigint, country text, participants bigint, km numeric, month_km numeric\)/);assert.match(sql,/NULL::numeric AS month_km/);assert.doesNotMatch(sql,/sum\(month_km\)/);assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.ranking_nations_monthly\(integer,integer\) TO anon,authenticated/);});
check('annual ranking and participants remain',()=>{assert.match(sql,/row_number\(\) OVER \(ORDER BY sum\(km\) DESC,country ASC\)/);assert.match(sql,/country,count\(\*\) AS participants,round\(sum\(km\),1\) AS km/);});

// Verify that the candidate changes no annual query expression accidentally.
// Normalize the original public function solely by removing the month-only aggregate,
// replacing its exposed month_km with NULL, and adding the candidate's explanatory header.
const original=fs.readFileSync('supabase/ranking-monthly.sql','utf8');
const signature='CREATE OR REPLACE FUNCTION public.ranking_nations_monthly(p_year integer, p_month integer)';
const originalFn=original.slice(original.indexOf(signature)).trim();
const candidateFn=sql.slice(sql.indexOf(signature)).trim();
check('candidate equals existing annual function except for month_km masking',()=>{
  assert.ok(original.includes(signature),'original NATIONS RPC missing');
  const monthExpression=/,\s*coalesce\(sum\(r\.distance_km::numeric\) FILTER \(WHERE s\.join_nations IS TRUE AND extract\(month FROM r\.activity_date\)=p_month\),0\) AS month_km/;
  assert.match(originalFn,monthExpression);
  const expected=originalFn.replace(monthExpression,'').replace('round(sum(month_km),1) AS month_km','NULL::numeric AS month_km').trim();
  assert.equal(candidateFn,expected);
});
check('monthly value cannot be accidentally reintroduced via another query expression',()=>{
  assert.doesNotMatch(candidateFn,/extract\(month FROM r\.activity_date\)/);
  assert.equal((candidateFn.match(/month_km/g)||[]).length,2); // return column + NULL alias
});

console.log(n+'/'+n+' candidate static invariants PASS; NOT a PostgreSQL or live browser test');
