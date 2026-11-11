import {NextResponse} from "next/server";
import {getUserFromBearerToken} from "../../../../../lib/server-auth";
import {createSupabaseAdminClient} from "../../../../../lib/supabase-admin";
import {firstExceededLimit,rateLimitHeaders} from "../../../../../lib/api-limits";
import {consumeRateLimit} from "../../../../../lib/request-security";
import {readRequestJson,RequestBodyError} from "../../../../../lib/request-body";
import {prepareAvatarAudio,AvatarAudioError} from "../../../../../lib/avatar-audio";

export async function POST(request:Request) {
  try {
    const user=await getUserFromBearerToken(request.headers.get("authorization"));
    if(!user)return NextResponse.json({error:"Sign in to verify audio."},{status:401});
    const limited=await firstExceededLimit(user.id,[{scope:"audio_inspect",limit:10,windowSeconds:60},{scope:"audio_inspect_hour",limit:100,windowSeconds:3600}],consumeRateLimit);
    if(limited)return NextResponse.json({error:"Audio verification is temporarily unavailable. Try again shortly."},{status:limited.unavailable?503:429,headers:rateLimitHeaders(limited.retryAfterSeconds)});
    const body=await readRequestJson(request,28*1024*1024);
    if(typeof body?.audioUrl!=="string")return NextResponse.json({error:"An audio file or URL is required."},{status:400});
    const admin=createSupabaseAdminClient();if(!admin)return NextResponse.json({error:"Audio storage is unavailable."},{status:503});
    return NextResponse.json(await prepareAvatarAudio(admin,user.id,body.audioUrl),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return NextResponse.json({error:error instanceof AvatarAudioError||error instanceof RequestBodyError?error.message:"Audio could not be verified."},{status:error instanceof AvatarAudioError||error instanceof RequestBodyError?error.status:400});
  }
}
