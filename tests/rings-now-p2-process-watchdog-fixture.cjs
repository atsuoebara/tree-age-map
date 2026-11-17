'use strict';
// Explicitly synthetic local child for watchdog unit tests. No P2 resources.
const mode=process.argv[2];
if(mode==='success') process.exit(0);
else if(mode==='failure') process.exit(7);
else if(mode==='hang') setInterval(()=>{},1000);
else if(mode==='ignore-term') {
 process.on('SIGTERM',()=>{});
 setInterval(()=>{},1000);
}
else process.exit(8);
