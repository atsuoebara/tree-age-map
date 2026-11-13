// Cross-language file-format proof for the portable 294-byte synthetic iPhone FIT.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Decoder,Stream} from '../fit-sdk/src/index.js';
import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs';
const root=mkdtempSync(join(tmpdir(),'rr-synthetic-fit-'));
try {
 const output=join(root,'test.fit');
 const src=fileURLToPath(new URL('../scripts/make-synthetic-race-fit-portable.py',import.meta.url));
 const run=spawnSync('python3',[src,output],{encoding:'utf8',timeout:5000});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const bin=readFileSync(output);
 assert.equal(bin.length,294);
 const buffer=bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength);
 const decoder=new Decoder(Stream.fromArrayBuffer(buffer));
 assert.equal(decoder.isFIT(),true);
 assert.equal(decoder.checkIntegrity(),true);
 const {messages,errors}=decoder.read();
 assert.deepEqual(errors,[]);
 assert.equal(messages.sessionMesgs.length,1);
 assert.equal(messages.sessionMesgs[0].sport,'running');
 assert.equal(messages.recordMesgs.length,26);
 assert.equal(messages.recordMesgs.at(-1).distance,5000);
 assert.ok(messages.recordMesgs.every(x=>x.positionLat==null&&x.positionLong==null&&x.heartRate==null));
 const result=reviewSingleUserFitBuffer(buffer,{confirmedOwner:true,confirmedRace:true});
 assert.equal(result.status,'candidate_unverified',JSON.stringify(result));
 assert.equal(result.clockElapsedS,1620);
 assert.deepEqual(result.segments.map(x=>Math.round(x.clockElapsedS)),[315,318,320,324,343]);
 assert.equal(result.writeAllowed,false);
 assert.equal(result.analysisAllowed,false);
 const attempt=spawnSync('python3',[src,output],{encoding:'utf8',timeout:5000});
 assert.notEqual(attempt.status,0,'must never overwrite an existing FIT');
 console.log('Portable 294-byte iPhone FIT fixture PASS: Python -> official FIT SDK CRC -> five synthetic splits; no GPS/HR, no overwrites');
}finally {rmSync(root,{recursive:true,force:true});}
