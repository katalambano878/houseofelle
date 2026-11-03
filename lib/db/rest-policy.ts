// Row-level access rules for the /rest/v1 and /rest/v1/rpc shims.
//
// Hosted Supabase enforced these with RLS. The plain-Postgres compat client
// connects as the table owner, so without this layer every browser request
// ran with full admin rights. The rules below mirror the original policies in
// supabase/migrations/20260209000000_complete_schema.sql, tightened where the
// originals leaked data (guest orders, coupon codes, self-promotion to admin).

import { verifyAccessToken } from "./auth";
import { query } from "./pool";
import { listEmbeddedTables } from "./supabase-compat";

export type CallerRole = "anon" | "customer" | "staff" | "admin";

export interface Caller {
  userId: string | null;
  role: CallerRole;
}

export type Op = "select" | "insert" | "update" | "delete";

type Row = Record<string, any>;

/** Tables the app owns. Anything else (pg_catalog views, auth schema) is unreachable. */
export const APP_TABLES = new Set([
  "addresses", "audit_logs", "banners", "blog_posts", "cart_items", "categories",
  "cms_content", "contact_submissions", "coupons", "customers", "navigation_items",
  "navigation_menus", "notifications", "order_items", "order_status_history", "orders",
  "pages", "product_images", "product_variants", "products", "profiles", "return_items",
  "return_requests", "review_images", "reviews", "site_settings", "store_modules",
  "store_settings", "support_messages", "support_tickets", "wishlist_items",
]);

/** Content tables only an admin (not staff) may change, as in the original RLS. */
const ADMIN_WRITE_TABLES = new Set([
  "site_settings", "cms_content", "banners", "navigation_menus", "navigation_items",
  "store_modules",
]);

/** Staff may add audit entries but never rewrite or erase them. */
const APPEND_ONLY_TABLES = new Set(["audit_logs"]);

/** RPCs the admin UI calls. Customers and guests may call none. */
const STAFF_RPCS = new Set(["mark_order_paid", "upsert_customer_from_order", "update_customer_stats"]);

interface Rule {
  /** Row must belong to the caller via this column. Requires a signed-in user. */
  owner?: string;
  /** Extra equality filters forced onto the query. */
  where?: Record<string, unknown>;
  /** Columns a non-staff caller may write. Others are dropped. */
  columns?: string[];
  /** Values forced onto inserted rows. */
  forced?: Record<string, unknown>;
  /** Allow guests (no sign-in) for this op. Owner rules always need sign-in. */
  public?: boolean;
}

type TableRules = Partial<Record<Op, Rule>>;

const PUBLIC_READ: Rule = { public: true };

/** Rules for customers and guests. Staff and admins bypass these. */
const RULES: Record<string, TableRules> = {
  products: { select: { public: true, where: { status: "active" } } },
  product_images: { select: PUBLIC_READ },
  product_variants: { select: PUBLIC_READ },
  categories: { select: PUBLIC_READ },
  banners: { select: { public: true, where: { is_active: true } } },
  cms_content: { select: { public: true, where: { is_active: true } } },
  navigation_menus: { select: PUBLIC_READ },
  navigation_items: { select: { public: true, where: { is_active: true } } },
  pages: { select: PUBLIC_READ },
  store_modules: { select: PUBLIC_READ },
  blog_posts: { select: { public: true, where: { status: "published" } } },
  reviews: {
    select: { public: true, where: { status: "approved" } },
    insert: {
      owner: "user_id",
      columns: ["product_id", "rating", "title", "content"],
      // New reviews wait for moderation in Admin → Reviews.
      forced: { status: "pending", verified_purchase: false },
    },
  },
  contact_submissions: {
    insert: { public: true, columns: ["name", "email", "phone", "subject", "message"] },
  },
  orders: { select: { owner: "user_id" } },
  profiles: {
    select: { owner: "id" },
    update: {
      owner: "id",
      columns: ["full_name", "phone", "avatar_url", "date_of_birth", "gender", "preferences"],
    },
  },
  addresses: {
    select: { owner: "user_id" },
    insert: { owner: "user_id" },
    update: { owner: "user_id" },
    delete: { owner: "user_id" },
  },
  cart_items: {
    select: { owner: "user_id" },
    insert: { owner: "user_id" },
    update: { owner: "user_id" },
    delete: { owner: "user_id" },
  },
  wishlist_items: {
    select: { owner: "user_id" },
    insert: { owner: "user_id" },
    update: { owner: "user_id" },
    delete: { owner: "user_id" },
  },
  notifications: {
    select: { owner: "user_id" },
    update: { owner: "user_id", columns: ["read_at"] },
    delete: { owner: "user_id" },
  },
  support_tickets: {
    select: { owner: "user_id" },
    insert: { owner: "user_id", columns: ["email", "subject", "description", "category"] },
  },
  return_requests: { select: { owner: "user_id" } },
};

/** Tables any caller may embed, and child tables readable under an owned parent. */
const PUBLIC_EMBEDS = new Set(["products", "product_images", "product_variants", "categories"]);
const CHILD_EMBEDS: Record<string, Set<string>> = {
  orders: new Set(["order_items", "order_status_history"]),
};

/** Columns never shown to customers or guests. */
const HIDDEN_COLUMNS = new Set(["cost_per_item"]);

export function isStaff(caller: Caller): boolean {
  return caller.role === "staff" || caller.role === "admin";
}

export async function resolveCaller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { userId: null, role: "anon" };
  const verified = await verifyAccessToken(token);
  if (!verified) return { userId: null, role: "anon" };
  // Read the role fresh so a demoted admin loses access straight away.
  const { rows } = await query<{ role: string }>(
    `SELECT role::text AS role FROM profiles WHERE id = $1 LIMIT 1`,
    [verified.userId]
  ).catch(() => ({ rows: [] as { role: string }[] }));
  const role = rows[0]?.role;
  if (role === "admin" || role === "staff") return { userId: verified.userId, role };
  return { userId: verified.userId, role: "customer" };
}

export interface Decision {
  ok: boolean;
  status?: number;
  message?: string;
  /** Equality filters to AND onto the query. */
  filters?: Record<string, unknown>;
  /** True when the caller can see nothing, so the query should match no rows. */
  empty?: boolean;
  rule?: Rule;
}

const deny = (status: number, message: string): Decision => ({ ok: false, status, message });

export function authorize(caller: Caller, table: string, op: Op, select?: string): Decision {
  if (!APP_TABLES.has(table)) return deny(404, `Unknown table: ${table}`);

  if (isStaff(caller)) {
    if (op !== "select" && ADMIN_WRITE_TABLES.has(table) && caller.role !== "admin") {
      return deny(403, "Only an admin can change this content.");
    }
    if (APPEND_ONLY_TABLES.has(table) && (op === "update" || op === "delete")) {
      return deny(403, "Audit entries cannot be changed.");
    }
    if (table === "profiles" && op === "delete") {
      return deny(403, "Profiles cannot be deleted here.");
    }
    return { ok: true };
  }

  const rule = RULES[table]?.[op];
  if (!rule) return deny(403, "Permission denied");

  if (op === "select" && select) {
    for (const { parent, table: child } of listEmbeddedTables(table, select)) {
      if (PUBLIC_EMBEDS.has(child)) continue;
      if (CHILD_EMBEDS[parent]?.has(child)) continue;
      return deny(403, `Permission denied for ${child}`);
    }
  }

  const filters: Record<string, unknown> = { ...(rule.where || {}) };
  if (rule.owner) {
    if (!caller.userId) {
      // Guests see no private rows (matches RLS returning an empty set) and cannot write.
      if (op === "select") return { ok: true, empty: true, rule };
      return deny(401, "Please sign in first.");
    }
    filters[rule.owner] = caller.userId;
  } else if (!rule.public && !caller.userId) {
    return deny(401, "Please sign in first.");
  }

  return { ok: true, filters, rule };
}

/** Restricts a non-staff write payload to its allowed columns and ownership. */
export function shapeWrite(
  caller: Caller,
  decision: Decision,
  row: Row,
  op: "insert" | "update",
  table?: string
): Row {
  if (isStaff(caller)) {
    let out = row;
    // Only an admin can hand out or remove admin/staff roles.
    if (caller.role !== "admin" && "role" in out) {
      const { role: _ignored, ...rest } = out;
      out = rest;
    }
    // Staff log their own actions and sales only, never under someone else's name.
    if (table === "audit_logs" && op === "insert") {
      out = { ...out, user_id: caller.userId };
    }
    if (table === "orders" && out.metadata && typeof out.metadata === "object" && "sold_by_id" in out.metadata) {
      out = { ...out, metadata: { ...out.metadata, sold_by_id: caller.userId } };
    }
    return out;
  }
  const rule = decision.rule || {};
  let out: Row = {};
  if (rule.columns) {
    for (const col of rule.columns) if (col in row) out[col] = row[col];
  } else {
    out = { ...row };
    delete out.id;
  }
  if (rule.owner) {
    if (op === "insert") out[rule.owner] = caller.userId;
    else delete out[rule.owner];
  }
  if (op === "insert" && rule.forced) Object.assign(out, rule.forced);
  return out;
}

export function canCallRpc(caller: Caller, fn: string): boolean {
  return isStaff(caller) && STAFF_RPCS.has(fn);
}

/** Removes internal columns (supplier cost) from rows shown to customers. */
export function redact<T>(caller: Caller, data: T): T {
  if (isStaff(caller) || data == null) return data;
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Row = {};
      for (const [k, val] of Object.entries(v)) {
        if (HIDDEN_COLUMNS.has(k)) continue;
        o[k] = walk(val);
      }
      return o;
    }
    return v;
  };
  return walk(data);
}
