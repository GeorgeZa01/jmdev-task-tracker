import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Integration tests for the manage-users edge function.
// Verifies that ONLY admins can list/update/deactivate users.

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  Deno.test(
    "manage-users integration tests skipped — SUPABASE_SERVICE_ROLE_KEY not available",
    () => {
      console.log(
        "Skipping manage-users integration tests: SUPABASE_SERVICE_ROLE_KEY is not set in the environment. " +
          "These tests need the service role key to provision and clean up test users.",
      );
    },
  );
} else {
  assert(SUPABASE_URL, "SUPABASE_URL is required");
  assert(ANON_KEY, "anon key is required");

  const FN_URL = `${SUPABASE_URL}/functions/v1/manage-users`;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  type Role = "admin" | "agent" | "user";

  interface Caller {
    id: string;
    email: string;
    accessToken: string;
  }

  async function provisionCaller(role: Role): Promise<Caller> {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `mu-${role}-${stamp}@example.test`;
    const password = `Test-${stamp}-Aa1!`;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `MU ${role} ${stamp}` },
    });
    if (error || !created.user) throw error ?? new Error("createUser failed");

    if (role !== "user") {
      const { error: rErr } = await admin
        .from("user_roles")
        .update({ role })
        .eq("user_id", created.user.id);
      if (rErr) throw rErr;
    }

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: sErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (sErr || !session.session) throw sErr ?? new Error("signIn failed");

    return { id: created.user.id, email, accessToken: session.session.access_token };
  }

  async function cleanup(ids: string[]) {
    for (const id of ids) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch (_e) {
        // best effort
      }
    }
  }

  async function callFn(body: unknown, accessToken?: string) {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch (_e) {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  Deno.test("manage-users rejects unauthenticated requests", async () => {
    const { status } = await callFn({ action: "list" });
    assert(status === 401 || status === 403, `expected 401/403, got ${status}`);
  });

  Deno.test("manage-users rejects a normal user", async () => {
    const caller = await provisionCaller("user");
    try {
      const { status, json } = await callFn({ action: "list" }, caller.accessToken);
      assertEquals(status, 403);
      assertEquals(json.error, "Only admins can manage users");
    } finally {
      await cleanup([caller.id]);
    }
  });

  Deno.test("manage-users rejects a support agent", async () => {
    const caller = await provisionCaller("agent");
    try {
      const { status, json } = await callFn({ action: "list" }, caller.accessToken);
      assertEquals(status, 403);
      assertEquals(json.error, "Only admins can manage users");
    } finally {
      await cleanup([caller.id]);
    }
  });

  Deno.test("non-admin cannot change another user's role", async () => {
    const agent = await provisionCaller("agent");
    const target = await provisionCaller("user");
    try {
      const { status } = await callFn(
        { action: "update", userId: target.id, role: "admin" },
        agent.accessToken,
      );
      assertEquals(status, 403);

      const { data } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target.id)
        .maybeSingle();
      assertEquals(data?.role, "user");
    } finally {
      await cleanup([agent.id, target.id]);
    }
  });

  Deno.test("non-admin cannot deactivate another user", async () => {
    const normal = await provisionCaller("user");
    const target = await provisionCaller("user");
    try {
      const { status } = await callFn(
        { action: "deactivate", userId: target.id },
        normal.accessToken,
      );
      assertEquals(status, 403);

      const { data } = await admin.auth.admin.getUserById(target.id);
      const banned = (data.user as unknown as { banned_until?: string | null })
        ?.banned_until;
      assert(!banned || new Date(banned) <= new Date(), "target should still be active");
    } finally {
      await cleanup([normal.id, target.id]);
    }
  });

  Deno.test("admin can list and update users", async () => {
    const adminCaller = await provisionCaller("admin");
    const target = await provisionCaller("user");
    try {
      const listRes = await callFn({ action: "list" }, adminCaller.accessToken);
      assertEquals(listRes.status, 200);
      assert(Array.isArray(listRes.json.users), "expected a users array");

      const updateRes = await callFn(
        { action: "update", userId: target.id, role: "agent" },
        adminCaller.accessToken,
      );
      assertEquals(updateRes.status, 200);

      const { data } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target.id)
        .maybeSingle();
      assertEquals(data?.role, "agent");
    } finally {
      await cleanup([adminCaller.id, target.id]);
    }
  });

  Deno.test("admin cannot modify their own account through the function", async () => {
    const adminCaller = await provisionCaller("admin");
    try {
      const { status } = await callFn(
        { action: "deactivate", userId: adminCaller.id },
        adminCaller.accessToken,
      );
      assertEquals(status, 400);
    } finally {
      await cleanup([adminCaller.id]);
    }
  });
}
