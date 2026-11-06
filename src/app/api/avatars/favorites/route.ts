import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { favoriteAvatar, listAvatarFavorites, removeAvatarFavorite, saveAvatarFavorite } from "../../../../lib/avatar-favorites";

const headers = {"Cache-Control":"no-store"};
export async function GET(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) return NextResponse.json({code:"unauthorized"},{status:401,headers});
  try { return NextResponse.json({items:await listAvatarFavorites(user.id)},{headers}); }
  catch { return NextResponse.json({code:"favorites_unavailable"},{status:503,headers}); }
}

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) return NextResponse.json({code:"unauthorized"},{status:401,headers});
  let body: {item?:unknown; favorite?:unknown};
  try { const text=await request.text(); if(text.length>20_000) return NextResponse.json({code:"invalid_favorite"},{status:400,headers}); body=JSON.parse(text); }
  catch { return NextResponse.json({code:"invalid_favorite"},{status:400,headers}); }
  const item = favoriteAvatar(body?.item);
  if (!item || typeof body.favorite!=="boolean") return NextResponse.json({code:"invalid_favorite"},{status:400,headers});
  try {
    if (body.favorite) await saveAvatarFavorite(user.id,item);
    else await removeAvatarFavorite(user.id,item.kind,item.id);
    return NextResponse.json({ok:true},{headers});
  } catch { return NextResponse.json({code:"favorites_unavailable"},{status:503,headers}); }
}
