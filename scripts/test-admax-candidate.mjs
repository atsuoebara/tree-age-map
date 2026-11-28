import assert from 'node:assert/strict';
import worker from './admax-worker-candidate.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const defaults={url:'https://ads.runnersrings.com/frame/sp01',method:'GET',cf:{country:'JP'},headers:new Headers({'sec-fetch-dest':'iframe','sec-fetch-site':'same-site'})};
for(const [label,patch,ok] of [
 ['JP',{},true],['EU',{cf:{country:'DE'}},false],['US',{cf:{country:'US'}},false],['UK',{cf:{country:'GB'}},false],['Tor',{cf:{country:'T1'}},false],['missing',{cf:undefined},false],['unknown',{cf:{country:'XX'}},false],['direct',{headers:new Headers({'sec-fetch-dest':'document','sec-fetch-site':'none'})},false],['cross-site',{headers:new Headers({'sec-fetch-dest':'iframe','sec-fetch-site':'cross-site'})},false],['query',{url:defaults.url+'?id=1'},false],['path',{url:'https://ads.runnersrings.com/other'},false],['host',{url:'https://example.com/frame/sp01'},false],['post',{method:'POST'},false]
]){
 const response=worker.fetch({...defaults,...patch});const body=await response.text();
 assert.equal(body.includes('Local synthetic ad placeholder'),ok,label);
 assert.equal(body.includes('shinobi.jp'),false,label);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors https:\/\/runnersrings\.com/);
 console.log('PASS',label);
}
const loader=await readFile(new URL('../rr-admax.js',import.meta.url),'utf8');
vm.runInNewContext(loader,{}); // disabled path must return before touching any DOM or network global
console.log('PASS disabled loader');
