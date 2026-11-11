export class RequestBodyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Bound streamed and chunked bodies before buffering or JSON parsing. */
export async function readRequestJson(request: Request, maxBytes: number): Promise<any> {
  if(Number(request.headers.get("content-length")||0)>maxBytes)throw new RequestBodyError(413,"Request is too large. Reduce uploaded media and try again.");
  // Legacy unit fixtures expose json() only. Real requests use the bounded stream.
  if (!request.body) {
    try { return await request.json(); }
    catch { throw new RequestBodyError(400, "Invalid JSON request."); }
  }
  const bytes=await readRequestBytes(request,maxBytes);
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new RequestBodyError(400,"Invalid JSON request."); }
}

export async function readRequestBytes(request:Request,maxBytes:number):Promise<Buffer> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new RequestBodyError(413, "Request is too large. Reduce uploaded media and try again.");
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestBodyError(413, "Request is too large. Reduce uploaded media and try again."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
