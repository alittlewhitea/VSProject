import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { downloadAudio, MAX_AUDIO_BYTES } from "./audio-download";
import { wavDataUrlSeconds } from "./generation-billing-normalize";
import { siteUrl } from "./site-url";

const run=promisify(execFile);
export class AvatarAudioError extends Error { constructor(message:string,public status=400){super(message);} }
export function audioBillableSeconds(seconds:number,maxSeconds:number) {
  if(!Number.isFinite(seconds)||seconds<=0||seconds>maxSeconds+0.05)throw new AvatarAudioError(`AI Avatar audio must be ${maxSeconds} seconds or shorter.`);
  return Math.min(maxSeconds,Math.max(1,Math.ceil(seconds-0.05)));
}
function wavFromPcm(pcm:Buffer) {
  const header=Buffer.alloc(44);header.write("RIFF",0);header.writeUInt32LE(pcm.length+36,4);header.write("WAVEfmt ",8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}
async function decodeAudio(bytes:Buffer,maxSeconds:number) {
  const binary=process.env.FFMPEG_PATH?.trim()||"ffmpeg";
  const directory=await mkdtemp(path.join(tmpdir(),"dreamface-audio-"));
  try {
    const input=path.join(directory,"input");await writeFile(input,bytes,{flag:"wx"});
    try {
      const {stdout}=await run(binary,["-v","error","-nostdin","-max_alloc","33554432","-protocol_whitelist","file,pipe","-format_whitelist","wav,mp3,ogg,matroska,webm,mov,aac,flac","-threads","1","-i",input,"-map","0:a:0","-vn","-sn","-dn","-t",String(maxSeconds+1),"-ac","1","-ar","16000","-threads","1","-f","s16le","pipe:1"],{encoding:"buffer",timeout:12000,maxBuffer:Math.ceil((maxSeconds+2)*32000),windowsHide:true});
      if(!stdout.length)throw new Error("Empty audio");
      const seconds=stdout.length/32000;audioBillableSeconds(seconds,maxSeconds);return {seconds,wav:wavFromPcm(stdout)};
    } catch(error) {
      if(error instanceof AvatarAudioError)throw error;
      if((error as NodeJS.ErrnoException).code==="ENOENT")throw new AvatarAudioError("Audio verification is temporarily unavailable.",503);
      throw new AvatarAudioError("This audio could not be decoded. Upload a valid WAV, MP3, M4A, AAC, OGG, WebM or FLAC file.");
    }
  } finally { await rm(directory,{recursive:true,force:true}); }
}

/** Price and submit the same immutable PCM bytes, including for mutable remote URLs. */
export async function prepareAvatarAudio(admin:any,userId:string,input:string,maxSeconds=15) {
  if(!/^[a-zA-Z0-9-]{1,64}$/.test(userId))throw new AvatarAudioError("Audio ownership could not be verified.");
  let bytes:Buffer;
  if(input.startsWith("data:")) {
    const match=/^data:audio\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(input);
    if(!match||match[1].length>Math.ceil(MAX_AUDIO_BYTES*4/3)+4)throw new AvatarAudioError("Upload a valid audio file smaller than 20 MB.");
    bytes=Buffer.from(match[1],"base64");
  } else {
    const url=new URL(input),ownOrigin=new URL(siteUrl()).origin;
    if(url.origin===ownOrigin&&url.pathname.startsWith("/api/uploads/generation-inputs/")) {
      const match=new RegExp(`^/api/uploads/generation-inputs/${userId}/audio-([a-f0-9]{64})\\.wav$`).exec(url.pathname);
      if(!match||url.search||url.hash)throw new AvatarAudioError("Use your own verified audio upload.");
      bytes=await readFile(path.join(process.cwd(),".data","uploads","generation-inputs",userId,`audio-${match[1]}.wav`));
      if(createHash("sha256").update(bytes).digest("hex")!==match[1])throw new AvatarAudioError("Audio changed. Upload it again.");
    } else {
      try { bytes=await downloadAudio(input); }
      catch { throw new AvatarAudioError("Audio could not be downloaded. Use a public audio URL or upload a file."); }
    }
  }
  if(!bytes.length||bytes.length>MAX_AUDIO_BYTES)throw new AvatarAudioError("Upload audio smaller than 20 MB.");
  let seconds:number,wav:Buffer;
  if(bytes.subarray(0,4).toString()==="RIFF") {
    const measured=wavDataUrlSeconds(`data:audio/wav;base64,${bytes.toString("base64")}`);
    if(measured===null)throw new AvatarAudioError("Invalid WAV audio. Upload it again.");
    seconds=measured;wav=bytes;
  } else ({seconds,wav}=await decodeAudio(bytes,maxSeconds));
  const billableSeconds=audioBillableSeconds(seconds,maxSeconds);
  const hash=createHash("sha256").update(wav).digest("hex"),objectPath=`${userId}/audio-${hash}.wav`;
  const bucket=admin.storage.from("generation-inputs");
  const {error}=await bucket.upload(objectPath,wav,{contentType:"audio/wav",upsert:true});
  if(error)throw new AvatarAudioError("Audio could not be saved. Please try again.",503);
  return {seconds,billableSeconds,audioUrl:bucket.getPublicUrl(objectPath).data.publicUrl};
}
