import { NextRequest, NextResponse } from "next/server";
import { createStorageClient } from "@/lib/db/storage";
import { isPlainPostgres } from "@/lib/db/mode";
import { isStaff, resolveCaller } from "@/lib/db/rest-policy";

import { guardStorageWrite } from "@/lib/db/rest-guard";

const BUCKETS = new Set(["products", "media"]);

// The admin may be open on www.* while NEXT_PUBLIC_SUPABASE_URL points at the
// bare domain, so uploads are cross-origin. Auth is a bearer token, not a
// cookie, so allowing any origin exposes nothing (same as /rest/v1).
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-upsert, x-client-info, cache-control, x-metadata",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/avif": ["avif"],
  "application/pdf": ["pdf"],
};

/** Uploads and deletes are staff-only, mirroring the old storage.objects policies. */
async function guard(req: NextRequest, bucket: string): Promise<NextResponse | null> {
  if (!BUCKETS.has(bucket)) {
    return json({ error: "Unknown bucket" }, 404);
  }
  const caller = await resolveCaller(req);
  if (!isStaff(caller)) {
    return json({ error: "Only store staff can change files." }, 403);
  }
  return null;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supabase Storage upload:
 *   POST /storage/v1/object/{bucket}/{path}
 *   body = raw file bytes
 */
async function postUnguarded(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return json({ error: "DATABASE_URL not set" }, 503);
  }

  const { bucket, path } = await ctx.params;
  const blocked = await guard(req, bucket);
  if (blocked) return blocked;

  const objectPath = path.map(decodeURIComponent).join("/");
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true";
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return json({ error: "File is larger than 10 MB." }, 413);
  }

  // supabase-js sends File/Blob uploads as multipart form data (file in an
  // unnamed field); raw buffers arrive with their own content-type.
  let contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  let buf: Buffer;
  if (contentType === "multipart/form-data") {
    const form = await req.formData().catch(() => null);
    const file = form
      ? Array.from(form.values()).find((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v)
      : undefined;
    if (!file) return json({ error: "No file in upload" }, 400);
    contentType = (file.type || "").toLowerCase();
    buf = Buffer.from(await file.arrayBuffer());
  } else {
    buf = Buffer.from(await req.arrayBuffer());
  }

  const ext = objectPath.toLowerCase().split(".").pop() || "";
  // Only images and PDFs, so nobody can host HTML or scripts on the store's domain.
  if (!ALLOWED_TYPES[contentType]?.includes(ext)) {
    return json({ error: "Only JPG, PNG, WebP, GIF, AVIF or PDF files can be uploaded." }, 415);
  }
  if (buf.length > MAX_BYTES) {
    return json({ error: "File is larger than 10 MB." }, 413);
  }

  const storage = createStorageClient();
  const { data, error } = await storage.from(bucket).upload(objectPath, buf, {
    contentType,
    upsert,
  });

  if (error) {
    return json({ error: "Upload failed" }, 400);
  }

  const { data: pub } = storage.from(bucket).getPublicUrl(objectPath);
  return json({
    Key: `${bucket}/${objectPath}`,
    Id: data?.path,
    ...data,
    publicUrl: pub.publicUrl,
  });
}

async function deleteUnguarded(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return json({ error: "DATABASE_URL not set" }, 503);
  }
  const { bucket, path } = await ctx.params;
  const blocked = await guard(req, bucket);
  if (blocked) return blocked;

  const objectPath = path.map(decodeURIComponent).join("/");
  const storage = createStorageClient();
  const { error } = await storage.from(bucket).remove([objectPath]);
  if (error) {
    return json({ error: error.message }, 400);
  }
  return json({});
}

export const POST = guardStorageWrite(postUnguarded);
export const DELETE = guardStorageWrite(deleteUnguarded);
