import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://jmdev-ticketing.lovable.app",
  "https://id-preview--fe488b1c-4b32-4126-b60d-9c9be92b62d5.lovable.app",
  "http://localhost:8080",
];

const allowedOrigins =
  Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()).filter(Boolean) ??
  DEFAULT_ALLOWED_ORIGINS;

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

type Role = "admin" | "agent" | "user";
type Action = "list" | "update" | "deactivate" | "reactivate";

interface RequestBody {
  action: Action;
  userId?: string;
  role?: Role;
  fullName?: string;
  // Optional pagination / sorting / filtering for `list`
  page?: number;
  pageSize?: number;
  sortBy?: "fullName" | "email" | "role" | "createdAt" | "lastSignInAt" | "deactivated";
  sortDir?: "asc" | "desc";
  search?: string;
  roleFilter?: Role | "all";
  statusFilter?: "all" | "active" | "deactivated";
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    if (userError || !caller) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: adminRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) return json({ error: "Only admins can manage users" }, 403, corsHeaders);

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body || typeof body !== "object" || !body.action) {
      return json({ error: "Invalid request" }, 400, corsHeaders);
    }



    if (body.action === "list") {
      // Fetch all auth users (paged from the admin API).
      const authUsers: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>["data"]["users"] = [];
      const perPage = 1000;
      for (let p = 1; p <= 20; p++) {
        const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage });
        if (error) return json({ error: error.message }, 500, corsHeaders);
        authUsers.push(...data.users);
        if (data.users.length < perPage) break;
      }

      const ids = authUsers.map((u) => u.id);
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin.from("profiles").select("user_id, full_name").in("user_id", ids),
      ]);

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Role]));
      const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? ""]));

      let mapped = authUsers.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        fullName: nameMap.get(u.id) ?? (u.user_metadata?.full_name ?? ""),
        role: roleMap.get(u.id) ?? ("user" as Role),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        deactivated: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      }));

      // If the client didn't ask for pagination, keep the legacy shape.
      const wantsPaged =
        body.page !== undefined ||
        body.pageSize !== undefined ||
        body.sortBy !== undefined ||
        body.search !== undefined ||
        body.roleFilter !== undefined ||
        body.statusFilter !== undefined;

      if (!wantsPaged) {
        return json({ users: mapped, total: mapped.length }, 200, corsHeaders);
      }

      const search = String(body.search ?? "").trim().toLowerCase();
      const roleFilter = body.roleFilter ?? "all";
      const statusFilter = body.statusFilter ?? "all";
      if (roleFilter !== "all") mapped = mapped.filter((u) => u.role === roleFilter);
      if (statusFilter === "active") mapped = mapped.filter((u) => !u.deactivated);
      if (statusFilter === "deactivated") mapped = mapped.filter((u) => u.deactivated);
      if (search) {
        mapped = mapped.filter(
          (u) =>
            u.email.toLowerCase().includes(search) ||
            (u.fullName ?? "").toLowerCase().includes(search),
        );
      }

      const total = mapped.length;
      const sortBy = body.sortBy ?? "createdAt";
      const sortDir = body.sortDir === "asc" ? "asc" : "desc";
      const dir = sortDir === "asc" ? 1 : -1;
      mapped.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortBy];
        const bv = (b as Record<string, unknown>)[sortBy];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "boolean" && typeof bv === "boolean") {
          return (Number(av) - Number(bv)) * dir;
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });

      const page = Math.max(1, Math.floor(Number(body.page ?? 1)));
      const pageSize = Math.min(200, Math.max(5, Math.floor(Number(body.pageSize ?? 25))));
      const start = (page - 1) * pageSize;
      const users = mapped.slice(start, start + pageSize);

      return json({ users, total, page, pageSize }, 200, corsHeaders);
    }

    // Actions below require a target userId
    const targetId = body.userId;
    if (!targetId || typeof targetId !== "string") {
      return json({ error: "userId is required" }, 400, corsHeaders);
    }
    if (targetId === caller.id) {
      return json({ error: "You cannot modify your own account here" }, 400, corsHeaders);
    }

    if (body.action === "update") {
      const role = body.role;
      const fullName = body.fullName;
      const roleOk = role === undefined || role === "admin" || role === "agent" || role === "user";
      const nameOk =
        fullName === undefined ||
        (typeof fullName === "string" && fullName.trim().length >= 1 && fullName.length <= 100);
      if (!roleOk || !nameOk) return json({ error: "Invalid input" }, 400, corsHeaders);

      if (role) {
        const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", targetId);
        if (delErr) return json({ error: delErr.message }, 500, corsHeaders);
        const { error: insErr } = await admin.from("user_roles").insert({ user_id: targetId, role });
        if (insErr) return json({ error: insErr.message }, 500, corsHeaders);
      }

      if (fullName !== undefined) {
        const trimmed = fullName.trim();
        const { error: profErr } = await admin
          .from("profiles")
          .update({ full_name: trimmed })
          .eq("user_id", targetId);
        if (profErr) return json({ error: profErr.message }, 500, corsHeaders);
        await admin.auth.admin.updateUserById(targetId, { user_metadata: { full_name: trimmed } });
      }

      return json({ success: true }, 200, corsHeaders);
    }

    if (body.action === "deactivate") {
      // Ban for 100 years; Supabase Admin API accepts a duration string.
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: `${100 * 365 * 24}h`,
      } as unknown as Record<string, unknown>);
      if (error) return json({ error: error.message }, 500, corsHeaders);
      return json({ success: true }, 200, corsHeaders);
    }

    if (body.action === "reactivate") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      } as unknown as Record<string, unknown>);
      if (error) return json({ error: error.message }, 500, corsHeaders);
      return json({ success: true }, 200, corsHeaders);
    }

    return json({ error: "Unknown action" }, 400, corsHeaders);
  } catch (err) {
    console.error("manage-users error:", err);
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});