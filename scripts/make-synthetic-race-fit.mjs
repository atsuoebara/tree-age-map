// Synthetic FIT generator for an iPhone file-picker rehearsal, NEVER an athlete record.
// No network, tracking, persisted app data, or real GPS/HR. Output path must be explicit.
// In a private checkout: node scripts/make-synthetic-race-fit.mjs /path/to/demo.fit
import {Encoder} from '../fit-sdk/src/index.js';
import {writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const start=new Date('2026-11-03T00:00:00.000Z');
const elapsed=[315,318,320,324,343]; // 5.00km / 27:00 synthetic only.
const at=s=>new Date(start.getTime()+s*1000);
export function makeSyntheticRaceFit(){
 const encoder=new Encoder();
 const totalS=elapsed.reduce((a,b)=>a+b,0);
 encoder.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:at(totalS),totalDistance:5000});
 encoder.writeMesg({mesgNum:20,timestamp:at(0),distance:0});
 let beginS=0;
 for(let km=0;km<elapsed.length;km++){
  const duration=elapsed[km];
  // 5 records per kilometre: 200m increments, preserving exact 1km clocks.
  for(let part=1;part<=5;part++){
   const s=beginS+duration*part/5;
   encoder.writeMesg({mesgNum:20,timestamp:at(Math.round(s)),distance:km*1000+part*200});
  }
  beginS+=duration;
 }
 const bytes=encoder.close();
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const output=process.argv[2];
 if(!output||extname(output).toLowerCase()!=='.fit')throw Error('Explicit .fit output path required; no default file or upload');
 const binary=makeSyntheticRaceFit();
 await writeFile(output,new Uint8Array(binary),{flag:'wx',mode:0o600});
 console.log('Synthetic test FIT written ('+binary.byteLength+' bytes). No GPS, personal data or network.'); 
}
