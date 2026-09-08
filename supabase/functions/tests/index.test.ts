import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// RLS integration tests for tickets + comments across the three roles
// (admin, agent, user). Each test provisions fresh users via the service
// role, then hits the API through the anon client with a real JWT — the
// same path the frontend uses — so RLS is genuinely exercised.

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

assert(SUPABASE_URL, "SUPABASE_URL is required");
assert(ANON_KEY, "SUPABASE_PUBLISHABLE_KEY / anon key is required");
assert(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required to provision test users");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = "admin" | "agent" | "user";

interface TestUser {
  id: string;
  email: string;
  password: string;
  role: Role;
  client: SupabaseClient;
}

async function provisionUser(role: Role): Promise<TestUser> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `rls-${role}-${stamp}@example.test`;
  const password = `Test-${stamp}-Aa1!`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${role} ${stamp}` },
  });
  if (createErr || !created.user) throw createErr ?? new Error("createUser failed");

  // Default role is 'user' via handle_new_user_role trigger. Override for admin/agent.
  if (role !== "user") {
    const { error: roleErr } = await admin
      .from("user_roles")
      .update({ role })
      .eq("user_id", created.user.id);
    if (roleErr) throw roleErr;
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  return { id: created.user.id, email, password, role, client };
}

async function cleanupUsers(users: TestUser[]) {
  for (const u of users) {
    try {
      await admin.auth.admin.deleteUser(u.id);
    } catch (_e) {
      // best effort
    }
  }
}

async function createTicketAs(u: TestUser, title: string) {
  return await u.client
    .from("tickets")
    .insert({
      title,
      description: "rls fixture",
      priority: "low",
      labels: [],
      author_id: u.id,
      author_name: u.email,
      author_email: u.email,
    })
    .select()
    .single();
}

/* ------------------------------- TICKETS -------------------------------- */

test("tickets: anonymous requests cannot read", async () => {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.from("tickets").select("id").limit(1);
  // Either an explicit error or an empty result — never actual rows.
  assert(error !== null || (data ?? []).length === 0, "anon should not read tickets");
});

test("tickets: normal user sees only their own tickets", async () => {
  const [alice, bob] = await Promise.all([provisionUser("user"), provisionUser("user")]);
  try {
    const { data: aliceTicket, error: aliceErr } = await createTicketAs(alice, "alice ticket");
    assertEquals(aliceErr, null);
    assert(aliceTicket);

    const { data: bobTicket, error: bobErr } = await createTicketAs(bob, "bob ticket");
    assertEquals(bobErr, null);
    assert(bobTicket);

    // Alice lists — should see her own, not Bob's.
    const { data: aliceList } = await alice.client.from("tickets").select("id, author_id");
    const ids = (aliceList ?? []).map((t) => t.id);
    assert(ids.includes(aliceTicket.id), "alice should see her own ticket");
    assert(!ids.includes(bobTicket.id), "alice must NOT see bob's ticket");

    // Direct fetch of Bob's ticket returns nothing for Alice.
    const { data: direct } = await alice.client
      .from("tickets")
      .select("id")
      .eq("id", bobTicket.id)
      .maybeSingle();
    assertEquals(direct, null);
  } finally {
    await cleanupUsers([alice, bob]);
  }
});

test("tickets: agent and admin can read every ticket", async () => {
  const [author, agent, adminUser] = await Promise.all([
    provisionUser("user"),
    provisionUser("agent"),
    provisionUser("admin"),
  ]);
  try {
    const { data: ticket } = await createTicketAs(author, "visible to staff");
    assert(ticket);

    const { data: seenByAgent } = await agent.client
      .from("tickets")
      .select("id")
      .eq("id", ticket.id)
      .maybeSingle();
    assertEquals(seenByAgent?.id, ticket.id);

    const { data: seenByAdmin } = await adminUser.client
      .from("tickets")
      .select("id")
      .eq("id", ticket.id)
      .maybeSingle();
    assertEquals(seenByAdmin?.id, ticket.id);
  } finally {
    await cleanupUsers([author, agent, adminUser]);
  }
});

test("tickets: users cannot update others' tickets; agents and admins can", async () => {
  const [author, other, agent, adminUser] = await Promise.all([
    provisionUser("user"),
    provisionUser("user"),
    provisionUser("agent"),
    provisionUser("admin"),
  ]);
  try {
    const { data: ticket } = await createTicketAs(author, "update target");
    assert(ticket);

    // Author can update own.
    const { data: selfUpd } = await author.client
      .from("tickets")
      .update({ title: "updated by author" })
      .eq("id", ticket.id)
      .select();
    assertEquals(selfUpd?.length, 1);

    // Other regular user cannot update (RLS makes the row invisible → 0 rows updated).
    const { data: otherUpd } = await other.client
      .from("tickets")
      .update({ title: "hijack" })
      .eq("id", ticket.id)
      .select();
    assertEquals(otherUpd?.length ?? 0, 0, "other user must not update someone else's ticket");

    // Agent can update.
    const { data: agentUpd } = await agent.client
      .from("tickets")
      .update({ status: "closed" })
      .eq("id", ticket.id)
      .select();
    assertEquals(agentUpd?.length, 1);

    // Admin can update.
    const { data: adminUpd } = await adminUser.client
      .from("tickets")
      .update({ status: "open" })
      .eq("id", ticket.id)
      .select();
    assertEquals(adminUpd?.length, 1);
  } finally {
    await cleanupUsers([author, other, agent, adminUser]);
  }
});

test("tickets: only admin can delete", async () => {
  const [author, agent, adminUser] = await Promise.all([
    provisionUser("user"),
    provisionUser("agent"),
    provisionUser("admin"),
  ]);
  try {
    const mk = async () => {
      const { data } = await createTicketAs(author, "delete target");
      assert(data);
      return data;
    };

    // User cannot delete own ticket.
    const t1 = await mk();
    const { data: userDel } = await author.client
      .from("tickets")
      .delete()
      .eq("id", t1.id)
      .select();
    assertEquals(userDel?.length ?? 0, 0, "user must not delete tickets");

    // Agent cannot delete.
    const t2 = await mk();
    const { data: agentDel } = await agent.client
      .from("tickets")
      .delete()
      .eq("id", t2.id)
      .select();
    assertEquals(agentDel?.length ?? 0, 0, "agent must not delete tickets");

    // Admin can delete.
    const t3 = await mk();
    const { data: adminDel } = await adminUser.client
      .from("tickets")
      .delete()
      .eq("id", t3.id)
      .select();
    assertEquals(adminDel?.length, 1);
  } finally {
    await cleanupUsers([author, agent, adminUser]);
  }
});

/* ------------------------------- COMMENTS ------------------------------- */

test("comments: cannot be created spoofing another author_id", async () => {
  const [alice, bob] = await Promise.all([provisionUser("user"), provisionUser("user")]);
  try {
    const { data: ticket } = await createTicketAs(alice, "spoof test");
    assert(ticket);

    // Alice tries to insert a comment claiming to be Bob → policy requires author_id = auth.uid().
    const { error } = await alice.client.from("comments").insert({
      ticket_id: ticket.id,
      content: "spoofed",
      author_id: bob.id,
      author_name: bob.email,
    });
    assert(error, "insert with mismatched author_id must be rejected");
  } finally {
    await cleanupUsers([alice, bob]);
  }
});

test("comments: non-author regular user cannot comment on someone else's ticket", async () => {
  const [author, stranger] = await Promise.all([provisionUser("user"), provisionUser("user")]);
  try {
    const { data: ticket } = await createTicketAs(author, "comment access");
    assert(ticket);

    const { error } = await stranger.client.from("comments").insert({
      ticket_id: ticket.id,
      content: "should be blocked",
      author_id: stranger.id,
      author_name: stranger.email,
    });
    assert(error, "stranger must not be able to comment on a ticket they can't see");
  } finally {
    await cleanupUsers([author, stranger]);
  }
});

test("comments: author, agent, and admin can all comment; users see only their own tickets' comments", async () => {
  const [author, other, agent, adminUser] = await Promise.all([
    provisionUser("user"),
    provisionUser("user"),
    provisionUser("agent"),
    provisionUser("admin"),
  ]);
  try {
    const { data: ticket } = await createTicketAs(author, "commentable");
    assert(ticket);

    for (const u of [author, agent, adminUser]) {
      const { error } = await u.client.from("comments").insert({
        ticket_id: ticket.id,
        content: `hello from ${u.role}`,
        author_id: u.id,
        author_name: u.email,
      });
      assertEquals(error, null, `${u.role} should be able to comment`);
    }

    // Author sees all comments on their ticket.
    const { data: authorView } = await author.client
      .from("comments")
      .select("id")
      .eq("ticket_id", ticket.id);
    assertEquals(authorView?.length, 3);

    // Unrelated user sees zero (parent ticket invisible to them).
    const { data: otherView } = await other.client
      .from("comments")
      .select("id")
      .eq("ticket_id", ticket.id);
    assertEquals(otherView?.length ?? 0, 0);
  } finally {
    await cleanupUsers([author, other, agent, adminUser]);
  }
});

test("comments: users can edit/delete only their own; staff can moderate any", async () => {
  const [author, commenter, agent, adminUser] = await Promise.all([
    provisionUser("user"),
    provisionUser("user"),
    provisionUser("agent"),
    provisionUser("admin"),
  ]);
  try {
    // Author owns the ticket so the other user needs to be able to see it —
    // give the commenter a comment on their OWN ticket instead.
    const { data: ticket } = await createTicketAs(commenter, "own ticket for comment moderation");
    assert(ticket);

    const insertBy = async (u: TestUser) => {
      const { data, error } = await u.client
        .from("comments")
        .insert({
          ticket_id: ticket.id,
          content: `by ${u.role}`,
          author_id: u.id,
          author_name: u.email,
        })
        .select()
        .single();
      assertEquals(error, null);
      assert(data);
      return data;
    };

    const ownComment = await insertBy(commenter);
    // Agent/admin can see the ticket regardless, so they can comment too.
    const agentComment = await insertBy(agent);
    const adminComment = await insertBy(adminUser);

    // Author (a different unrelated user) cannot update commenter's comment.
    const { data: hijack } = await author.client
      .from("comments")
      .update({ content: "hijacked" })
      .eq("id", ownComment.id)
      .select();
    assertEquals(hijack?.length ?? 0, 0, "unrelated user must not edit others' comments");

    // Commenter can edit their own.
    const { data: selfEdit } = await commenter.client
      .from("comments")
      .update({ content: "edited by me" })
      .eq("id", ownComment.id)
      .select();
    assertEquals(selfEdit?.length, 1);

    // Agent can moderate any comment.
    const { data: agentEdit } = await agent.client
      .from("comments")
      .update({ content: "moderated by agent" })
      .eq("id", ownComment.id)
      .select();
    assertEquals(agentEdit?.length, 1);

    // Admin can delete any comment.
    const { data: adminDel } = await adminUser.client
      .from("comments")
      .delete()
      .eq("id", agentComment.id)
      .select();
    assertEquals(adminDel?.length, 1);

    // Non-owner user cannot delete admin's comment.
    const { data: badDel } = await commenter.client
      .from("comments")
      .delete()
      .eq("id", adminComment.id)
      .select();
    assertEquals(badDel?.length ?? 0, 0);
  } finally {
    await cleanupUsers([author, commenter, agent, adminUser]);
  }
});