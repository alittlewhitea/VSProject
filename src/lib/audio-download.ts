import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const blocked = new BlockList();
for (const [network, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(network,bits,"ipv4");
// Accept only global-unicast IPv6, then exclude special-purpose/tunnelling ranges.
const globalV6 = new BlockList(); globalV6.addSubnet("2000::",3,"ipv6");
for (const [network,bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const) blocked.addSubnet(network,bits,"ipv6");

export function isPublicAudioAddress(address: string) {
  const family=isIP(address);
  return family===4 ? !blocked.check(address,"ipv4") : family===6 && globalV6.check(address,"ipv6") && !blocked.check(address,"ipv6");
}

/** Resolve once per hop and pin that address to the socket. No private DNS answers,
 * credential forwarding, implicit redirects, alternate ports or remote media decoders.
 */
export async function downloadAudio(value: string, deadline = Date.now()+15000, redirects = 0): Promise<Buffer> {
  if (value.length>4096 || redirects>3) throw new Error("Audio URL has too many redirects or is too long.");
  const url=new URL(value),hostname=url.hostname.replace(/^\[|\]$/g,"");
  if (!["http:","https:"].includes(url.protocol)||url.username||url.password||(url.port&&url.port!==(url.protocol==="https:"?"443":"80"))||hostname.toLowerCase()==="localhost"||hostname.toLowerCase().endsWith(".localhost")) throw new Error("Use a public HTTP or HTTPS audio URL.");
  const remaining=deadline-Date.now();if(remaining<=0)throw new Error("Audio download timed out.");
  let dnsTimer:ReturnType<typeof setTimeout>|undefined;
  let addresses:{address:string;family:number}[];
  try {
    addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await Promise.race([
      lookup(hostname,{all:true,verbatim:true}),
      new Promise<never>((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error("Audio DNS timed out.")),Math.min(remaining,4000));})
    ]);
  } finally { clearTimeout(dnsTimer); }
  if (!addresses.length||addresses.some(row=>!isPublicAudioAddress(row.address))) throw new Error("Private or reserved audio addresses are not allowed.");
  const pinned=addresses[0];
  return new Promise<Buffer>((resolve,reject)=>{
    const request=(url.protocol==="https:"?https:http).get(url,{
      agent:false,
      headers:{Accept:"audio/*,application/octet-stream;q=0.8","Accept-Encoding":"identity"},
      lookup:((_name:string,options:any,callback:any)=>options?.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)) as any
    },response=>{
      const status=response.statusCode||0;
      if([301,302,303,307,308].includes(status)) {
        const location=response.headers.location;response.destroy();
        if(!location){reject(new Error("Invalid audio redirect."));return;}
        try {downloadAudio(new URL(location,url).toString(),deadline,redirects+1).then(resolve,reject);}
        catch {reject(new Error("Invalid audio redirect."));}
        return;
      }
      if(status!==200){response.destroy();reject(new Error("Audio URL could not be downloaded."));return;}
      if((response.headers["content-encoding"]||"identity")!=="identity"||Number(response.headers["content-length"]||0)>MAX_AUDIO_BYTES){response.destroy();reject(new Error("Audio is too large or compressed."));return;}
      const chunks:Buffer[]=[];let size=0;
      response.on("data",chunk=>{size+=chunk.length;if(size>MAX_AUDIO_BYTES){response.destroy(new Error("Audio must be smaller than 20 MB."));return;}chunks.push(Buffer.from(chunk));});
      response.on("error",reject);response.on("end",()=>size?resolve(Buffer.concat(chunks)):reject(new Error("Audio is empty.")));
    });
    const timer=setTimeout(()=>request.destroy(new Error("Audio download timed out.")),Math.max(1,deadline-Date.now()));
    request.on("error",reject);request.on("close",()=>clearTimeout(timer));
  });
}
