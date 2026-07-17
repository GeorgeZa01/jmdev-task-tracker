import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Integration tests for the create-user edge function.
// Provisions caller users via the service role, then invokes the deployed
// edge function with a real JWT (as the frontend would) and asserts both
// the HTTP response and the DB side effects.

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

assert(SUPABASE_URL, "SUPABASE_URL is required");
assert(ANON_KEY, "anon key is required");
assert(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required");

const FN_URL = `${SUPABASE_URL}/functions/v1/create-user`;

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
  const email = `cu-${role}-${stamp}@example.test`;
  const password = `Test-${stamp}-Aa1!`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `CU ${role} ${stamp}` },
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

async function deleteUserByEmail(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const match = data.users.find((u) => u.email === email);
  if (match) {
    try { await admin.auth.admin.deleteUser(match.id); } catch (_) { /* best effort */ }
  }
}

async function invoke(token: string | null, body: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { status: res.status, json, text };
}

function newEmail(tag: string) {
  return `cu-created-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

Deno.test("create-user: unauthenticated request is rejected", async () => {
  const email = newEmail("noauth");
  try {
    const { status, json } = await invoke(null, {
      email, password: "Password-123!", fullName: "No Auth", role: "user",
    });
    assertEquals(status, 401);
    assert(json?.error);

    // No user should have been created.
    const { data } = await admin.auth.admin.listUsers();
    assert(!data.users.some((u) => u.email === email));
  } finally {
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: non-admin caller is forbidden", async () => {
  const caller = await provisionCaller("user");
  const email = newEmail("nonadmin");
  try {
    const { status, json } = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "Blocked", role: "user",
    });
    assertEquals(status, 403);
    assert(json?.error);

    const { data } = await admin.auth.admin.listUsers();
    assert(!data.users.some((u) => u.email === email));
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: agent caller is also forbidden (admin-only)", async () => {
  const caller = await provisionCaller("agent");
  const email = newEmail("agentcaller");
  try {
    const { status } = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "Blocked Agent", role: "user",
    });
    assertEquals(status, 403);

    const { data } = await admin.auth.admin.listUsers();
    assert(!data.users.some((u) => u.email === email));
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: admin caller with invalid input gets 400", async () => {
  const caller = await provisionCaller("admin");
  try {
    // bad email
    const r1 = await invoke(caller.accessToken, {
      email: "not-an-email", password: "Password-123!", fullName: "X", role: "user",
    });
    assertEquals(r1.status, 400);

    // short password
    const r2 = await invoke(caller.accessToken, {
      email: newEmail("shortpw"), password: "short", fullName: "X", role: "user",
    });
    assertEquals(r2.status, 400);

    // invalid role
    const r3 = await invoke(caller.accessToken, {
      email: newEmail("badrole"), password: "Password-123!", fullName: "X", role: "superuser" as any,
    });
    assertEquals(r3.status, 400);

    // empty full name
    const r4 = await invoke(caller.accessToken, {
      email: newEmail("noname"), password: "Password-123!", fullName: "   ", role: "user",
    });
    assertEquals(r4.status, 400);
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
  }
});

Deno.test("create-user: admin creates a normal user — HTTP + DB side effects", async () => {
  const caller = await provisionCaller("admin");
  const email = newEmail("newuser");
  const fullName = "Freshly Created User";
  try {
    const { status, json } = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName, role: "user",
    });
    assertEquals(status, 200);
    assertEquals(json?.success, true);
    assertEquals(json?.user?.email, email);
    assertEquals(json?.user?.role, "user");
    assert(json?.user?.id, "response should include new user id");

    const newId: string = json.user.id;

    // auth.users row exists with confirmed email + metadata
    const { data: got, error: getErr } = await admin.auth.admin.getUserById(newId);
    assertEquals(getErr, null);
    assertEquals(got.user?.email, email);
    assert(got.user?.email_confirmed_at, "email should be confirmed");
    assertEquals((got.user?.user_metadata as any)?.full_name, fullName);

    // user_roles seeded to 'user' by handle_new_user_role trigger
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", newId);
    assertEquals(roles?.length, 1);
    assertEquals(roles?.[0].role, "user");

    // profiles row auto-created by handle_new_user_profile trigger
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", newId)
      .maybeSingle();
    assertEquals(profile?.user_id, newId);
    assertEquals(profile?.full_name, fullName);
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: admin creates an agent — role is updated in user_roles", async () => {
  const caller = await provisionCaller("admin");
  const email = newEmail("newagent");
  try {
    const { status, json } = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "New Agent", role: "agent",
    });
    assertEquals(status, 200);
    assertEquals(json?.user?.role, "agent");

    const newId: string = json.user.id;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", newId);
    assertEquals(roles?.length, 1);
    assertEquals(roles?.[0].role, "agent");
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: admin creates another admin — role is updated in user_roles", async () => {
  const caller = await provisionCaller("admin");
  const email = newEmail("newadmin");
  try {
    const { status, json } = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "New Admin", role: "admin",
    });
    assertEquals(status, 200);
    assertEquals(json?.user?.role, "admin");

    const newId: string = json.user.id;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", newId);
    assertEquals(roles?.[0].role, "admin");
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});

Deno.test("create-user: duplicate email returns 400 and does not create a second user", async () => {
  const caller = await provisionCaller("admin");
  const email = newEmail("dup");
  try {
    const first = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "First", role: "user",
    });
    assertEquals(first.status, 200);

    const second = await invoke(caller.accessToken, {
      email, password: "Password-123!", fullName: "Second", role: "user",
    });
    assertEquals(second.status, 400);
    assert(second.json?.error);

    const { data } = await admin.auth.admin.listUsers();
    const matches = data.users.filter((u) => u.email === email);
    assertEquals(matches.length, 1, "only one auth user should exist for this email");
  } finally {
    await admin.auth.admin.deleteUser(caller.id);
    await deleteUserByEmail(email);
  }
});