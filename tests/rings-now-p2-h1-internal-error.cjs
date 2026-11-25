'use strict';
// Only fixed categories cross the diagnostic boundary; never return log text.
const RULES=Object.freeze({
 '42P01':'UNDEFINED_TABLE','42703':'UNDEFINED_COLUMN','42501':'INSUFFICIENT_PRIVILEGE',
 '23502':'NOT_NULL_VIOLATION','23503':'FOREIGN_KEY_VIOLATION','23505':'UNIQUE_VIOLATION',
 '42883':'UNDEFINED_FUNCTION','3F000':'INVALID_SCHEMA','22P02':'INVALID_TEXT',
 '23514':'CHECK_VIOLATION','25P02':'FAILED_TRANSACTION'
});
const ALLOWED=Object.freeze([...Object.values(RULES),'NO_MATCH','UNAVAILABLE']);
function classifyLog(stdout,stderr){
 const found=new Set();
 for(const line of (String(stdout)+'\n'+String(stderr)).split('\n')){
  // SQLSTATE marker only; arbitrary text is never copied.
  for(const m of line.matchAll(/\bSQLSTATE(?:\s*[:=]\s*|\s+)([0-9A-Z]{5})\b/g)){
   if(Object.hasOwn(RULES,m[1]))found.add(RULES[m[1]]);
  }
 }
 return found.size?[...found].sort():['NO_MATCH'];
}
function safeCategories(value){
 if(!Array.isArray(value)||!value.length||value.length>ALLOWED.length||
 !value.every(x=>ALLOWED.includes(x)))return ['UNAVAILABLE'];
 return [...new Set(value)].sort();
}
module.exports={classifyLog,safeCategories};
