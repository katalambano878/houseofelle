import { readObject, safeContentType } from "@/lib/db/storage";
import { prepareStoredPhoto } from "@/lib/watermark/serve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  "Access-Control-Allow-Origin": "*",
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
): Promise<Response> {
  const { bucket, path } = await ctx.params;
  const objectPath = path.map(decodeURIComponent).join("/");
  const obj = await readObject(bucket, objectPath);
  if (!obj) {
    return new Response(JSON.stringify({ error: "Object not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const contentType = safeContentType(obj.contentType);

  // Product photos get the store watermark when it is on (Admin -> Image watermark). The file on disk is
  // never changed, and any failure serves the original.
  const photo = await prepareStoredPhoto(req, bucket, objectPath, obj.bytes, contentType).catch(() => null);
  if (photo) {
    const headers: Record<string, string> = {
      ...SECURITY_HEADERS,
      "Content-Type": safeContentType(photo.contentType),
      "Cache-Control": photo.cacheControl,
    };
    if (photo.etag) headers.ETag = photo.etag;
    return new Response(photo.body as BodyInit | null, { status: photo.status, headers });
  }

  return new Response(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
