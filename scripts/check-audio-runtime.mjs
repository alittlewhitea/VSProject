import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
let configured=process.env.FFMPEG_PATH?.trim();
if(!configured)try{const match=/^FFMPEG_PATH\s*=\s*(.*)$/m.exec(readFileSync('.env.local','utf8'));if(match)configured=match[1].trim().replace(/^['"]|['"]$/g,'');}catch{}
const binary=configured||'ffmpeg';
try {
 const run=promisify(execFile),{stdout}=await run(binary,['-version'],{timeout:5000,windowsHide:true});
 console.log(stdout.split(/\r?\n/)[0]);
 const probe=await run(binary,['-v','error','-nostdin','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','0.1','-f','s16le','pipe:1'],{encoding:'buffer',timeout:5000,maxBuffer:64000,windowsHide:true});
 if(probe.stdout.length!==3200)throw new Error('PCM decoding check failed');
 console.log('Audio runtime is ready: local FFmpeg executable and bounded PCM output verified. No network, database, uploads or provider jobs used.');
}catch {console.error('Audio runtime unavailable. Install a maintained FFmpeg package on this server, or set FFMPEG_PATH to its absolute executable path and restart the application.');process.exitCode=1;}
