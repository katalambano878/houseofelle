import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  applyPostgrestParams,
} from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";
import {
  authorize,
  isStaff,
  redact,
  resolveCaller,
  shapeWrite,
  type Caller,
  type Decision,
} from "@/lib/db/rest-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PG_IDENT = /^[a-z_][a-z0-9_]*$/i;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    // supabase-js reads row counts from Content-Range
    "Access-Control-Expose-Headers": "Content-Range",
  };
}

function preferSingle(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function preferReturn(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("return=representation") || prefer.includes("resolution=");
}

function preferCount(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("count=exact");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { message, code: "PGRST", details: null, hint: null },
    { status, headers: corsHeaders() }
  );
}

/** ANDs the policy's ownership/visibility filters onto a query. */
function applyDecision(qb: any, decision: Decision) {
  if (decision.empty) qb.in("id", []);
  for (const [col, val] of Object.entries(decision.filters || {})) qb.eq(col, val);
}

function denied(decision: Decision) {
  return jsonError(decision.message || "Permission denied", decision.status || 403);
}

/** Non-staff writes must name the rows they touch, so one request cannot hit a whole table. */
function hasRowFilter(params: URLSearchParams, caller: Caller): boolean {
  if (isStaff(caller)) return true;
  for (const key of params.keys()) {
    if (!["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) return true;
  }
  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const select = req.nextUrl.searchParams.get("select") || "*";
  const caller = await resolveCaller(req);
  const decision = authorize(caller, table, "select", select);
  if (!decision.ok) return denied(decision);

  const client = createClient();
  const qb = client.from(table);
  if (preferCount(req)) {
    qb.select(select, {
      count: "exact",
      head: req.headers.get("prefer")?.includes("head=true"),
    });
  } else {
    qb.select(select);
  }
  // Apply filters/order/limit without re-applying select
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.delete("select");
  applyPostgrestParams(qb as any, params, {
    preferSingle: preferSingle(req),
  });
  applyDecision(qb, decision);

  const result = await qb;
  if (result.error) {
    return jsonError(result.error.message || "Query failed", 400);
  }

  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json");
  if (result.count != null) {
    headers.set("Content-Range", `0-${Math.max((Array.isArray(result.data) ? result.data.length : 1) - 1, 0)}/${result.count}`);
  }

  if (preferSingle(req)) {
    return NextResponse.json(redact(caller, result.data), { status: 200, headers });
  }
  return NextResponse.json(redact(caller, result.data ?? []), { status: 200, headers });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const body = await req.json().catch(() => null);
  if (body == null || typeof body !== "object") return jsonError("Invalid JSON body");

  const caller = await resolveCaller(req);
  const decision = authorize(caller, table, "insert");
  if (!decision.ok) return denied(decision);

  const rows = (Array.isArray(body) ? body : [body]).map((row) =>
    shapeWrite(caller, decision, row || {}, "insert")
  );
  if (!isStaff(caller) && rows.length > 20) return jsonError("Too many rows in one request");

  const prefer = req.headers.get("prefer") || "";
  const upsert = /resolution=(merge|ignore)-duplicates/.test(prefer);
  if (upsert && !isStaff(caller)) return jsonError("Permission denied", 403);
  const onConflict = req.nextUrl.searchParams.get("on_conflict") || undefined;

  const client = createClient();
  const payload = Array.isArray(body) ? rows : rows[0];
  let qb = upsert
    ? client.from(table).upsert(payload, { onConflict })
    : client.from(table).insert(payload);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Insert failed", 400);

  return NextResponse.json(redact(caller, result.data), {
    status: 201,
    headers: corsHeaders(),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const body = await req.json().catch(() => null);
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid JSON body");
  }

  const caller = await resolveCaller(req);
  const decision = authorize(caller, table, "update");
  if (!decision.ok) return denied(decision);
  if (!hasRowFilter(req.nextUrl.searchParams, caller)) return jsonError("Add a filter to choose rows");

  const patch = shapeWrite(caller, decision, body, "update");
  if (Object.keys(patch).length === 0) return jsonError("Nothing you can change in this request", 403);

  const client = createClient();
  let qb = client.from(table).update(patch);
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  applyDecision(qb, decision);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Update failed", 400);

  return NextResponse.json(redact(caller, result.data), { status: 200, headers: corsHeaders() });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const caller = await resolveCaller(req);
  const decision = authorize(caller, table, "delete");
  if (!decision.ok) return denied(decision);
  if (!hasRowFilter(req.nextUrl.searchParams, caller)) return jsonError("Add a filter to choose rows");

  const client = createClient();
  let qb = client.from(table).delete();
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  applyDecision(qb, decision);
  if (preferReturn(req)) {
    qb = qb.select("*") as typeof qb;
  }

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Delete failed", 400);

  return NextResponse.json(redact(caller, result.data ?? null), { status: 200, headers: corsHeaders() });
}
