import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// RLS tests: a signed-in user may only create tickets under their own identity.
// Any attempt to set author_id to another user (or leave it null) must fail.

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  Deno.test(
    "ticket identity tests skipped — SUPABASE_SERVICE_ROLE_KEY not available",
    () => {
      console.log(
        "Skipping ticket identity RLS tests: SUPABASE_SERVICE_ROLE_KEY is not set in the environment.",
      );
    },
  );
} else {
  assert(SUPABASE_URL, "SUPABASE_URL is required");
  assert(ANON_KEY, "anon key is required");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  type Role = "admin" | "agent" | "user";

  interface TestUser {
    id: string;
    email: string;
    role: Role;
    client: SupabaseClient;
  }

  async function provisionUser(role: Role): Promise<TestUser> {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `ident-${role}-${stamp}@example.test`;
    const password = `Test-${stamp}-Aa1!`;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Ident ${role} ${stamp}` },
    });
    if (error || !created.user) throw error ?? new Error("createUser failed");

    if (role !== "user") {
      const { error: rErr } = await admin
        .from("user_roles")
        .update({ role })
        .eq("user_id", created.user.id);
      if (rErr) throw rErr;
    }

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: sErr } = await client.auth.signInWithPassword({ email, password });
    if (sErr) throw sErr;

    return { id: created.user.id, email, role, client };
  }

  async function cleanup(users: TestUser[]) {
    for (const u of users) {
      try {
        await admin.from("tickets").delete().eq("author_id", u.id);
        await admin.auth.admin.deleteUser(u.id);
      } catch (_e) {
        // best effort
      }
    }
  }

  Deno.test("user can create a ticket under their own identity", async () => {
    const u = await provisionUser("user");
    try {
      const { data, error } = await u.client
        .from("tickets")
        .insert({
          title: "Own identity ticket",
          description: "created by owner",
          author_id: u.id,
          author_name: "Ident user",
          author_email: u.email,
        })
        .select()
        .maybeSingle();

      assertEquals(error, null);
      assertEquals(data?.author_id, u.id);
    } finally {
      await cleanup([u]);
    }
  });

  Deno.test("user cannot create a ticket impersonating another user", async () => {
    const attacker = await provisionUser("user");
    const victim = await provisionUser("user");
    try {
      const { data, error } = await attacker.client
        .from("tickets")
        .insert({
          title: "Impersonated ticket",
          author_id: victim.id,
          author_name: "Victim",
          author_email: victim.email,
        })
        .select()
        .maybeSingle();

      assert(error, "insert with someone else's author_id must be rejected");
      assertEquals(data, null);

      const { count } = await admin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("author_id", victim.id);
      assertEquals(count ?? 0, 0);
    } finally {
      await cleanup([attacker, victim]);
    }
  });

  Deno.test("user cannot create a ticket with no author_id", async () => {
    const u = await provisionUser("user");
    try {
      const { error } = await u.client
        .from("tickets")
        .insert({ title: "Anonymous ticket", author_name: "Nobody" })
        .select()
        .maybeSingle();

      assert(error, "insert without author_id must be rejected");
    } finally {
      await cleanup([u]);
    }
  });

  Deno.test("staff also cannot create tickets on behalf of others", async () => {
    const agent = await provisionUser("agent");
    const victim = await provisionUser("user");
    try {
      const { error } = await agent.client
        .from("tickets")
        .insert({
          title: "Agent impersonation",
          author_id: victim.id,
          author_name: "Victim",
        })
        .select()
        .maybeSingle();

      assert(error, "agents must not be able to set another author_id");
    } finally {
      await cleanup([agent, victim]);
    }
  });

  Deno.test("anonymous visitors cannot create tickets", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon
      .from("tickets")
      .insert({ title: "Anon ticket", author_name: "Anon" })
      .select()
      .maybeSingle();

    assert(error, "anonymous inserts must be rejected");
  });
}
