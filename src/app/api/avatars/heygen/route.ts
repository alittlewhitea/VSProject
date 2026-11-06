import { NextResponse } from "next/server";
import { HeygenCatalogError, listHeygenPublicAvatars } from "../../../../lib/heygen-avatar-catalog";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") || "group";
  const groupId = params.get("groupId") || undefined;
  const token = params.get("token") || undefined;
  if (!["group","look"].includes(kind) || (groupId && (kind !== "look" || !/^[\w-]{1,160}$/.test(groupId))) || (token && token.length>2048)) {
    return NextResponse.json({code:"invalid_avatar_query"},{status:400});
  }
  try {
    const result = await listHeygenPublicAvatars({kind:kind as "group" | "look",groupId,token,preview:kind === "look" && params.get("preview") === "1"});
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const known = error instanceof HeygenCatalogError ? error : new HeygenCatalogError("heygen_unavailable",502);
    return NextResponse.json({code:known.code},{status:known.status,headers:{"Cache-Control":"no-store"}});
  }
}
