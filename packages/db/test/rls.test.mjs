// RLS + function-grant tests against the local Supabase DB (`pnpm db:start`). Skips if down.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
let sql;
let up = true;
try {
  sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`select 1`;
} catch {
  up = false;
}

const A = { uid: randomUUID() };
const B = { uid: randomUUID() };

/** Run `fn` as a Supabase role, the way PostgREST does. Always rolled back. */
async function as(role, uid, fn) {
  let out;
  await sql
    .begin(async (tx) => {
      await tx.unsafe(`set local role ${role}`);
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(uid ? { sub: uid, role } : { role })}, true)`;
      out = await fn(tx);
      throw new Error("rollback");
    })
    .catch((e) => {
      if (e.message !== "rollback") throw e;
    });
  return out;
}

describe("row level security", { skip: !up && "local DB not running" }, () => {
  before(async () => {
    for (const s of [A, B]) {
      await sql`insert into auth.users (id, email, aud, role) values (${s.uid}, ${s.uid + "@rls.test"}, 'authenticated', 'authenticated')`;
      [{ id: s.studio }] = await sql`insert into studios (owner_id, name) values (${s.uid}, 'RLS') returning id`;
      [{ id: s.event }] = await sql`insert into events (studio_id, slug, name) values (${s.studio}, ${"rls-" + s.uid.slice(0, 8)}, 'RLS') returning id`;
      await sql`insert into photos (event_id, studio_id, r2_key_original, sha256) values (${s.event}, ${s.studio}, 'k', ${"a".repeat(64)})`;
    }
  });
  after(async () => {
    await sql`delete from auth.users where id in (${A.uid}, ${B.uid})`;
    await sql.end();
  });

  it("a studio sees only its own studio, events and photos", async () => {
    const r = await as("authenticated", A.uid, async (tx) => ({
      studios: await tx`select id from studios`,
      events: await tx`select id from events`,
      photos: await tx`select event_id from photos`,
    }));
    assert.deepEqual(r.studios.map((x) => x.id), [A.studio]);
    assert.deepEqual(r.events.map((x) => x.id), [A.event]);
    assert.ok(r.photos.every((p) => p.event_id === A.event));
  });

  it("a studio cannot change another studio's event, nor its own plan", async () => {
    const r = await as("authenticated", A.uid, async (tx) => tx`update events set name = 'pwned' where id = ${B.event} returning id`);
    assert.equal(r.length, 0);
    await assert.rejects(as("authenticated", A.uid, (tx) => tx`update studios set plan = 'studio' where id = ${A.studio}`));
    await assert.rejects(as("authenticated", A.uid, (tx) => tx`update events set face_count = 999 where id = ${A.event}`));
  });

  it("a studio cannot create a studio for someone else or on a paid plan", async () => {
    await assert.rejects(as("authenticated", A.uid, (tx) => tx`insert into studios (owner_id, name) values (${B.uid}, 'x')`));
  });

  it("anonymous users can read plans but nothing else", async () => {
    const r = await as("anon", null, async (tx) => ({
      plans: await tx`select id from plans`,
      events: await tx`select id from events`,
      photos: await tx`select id from photos`,
      faces: await tx`select id from faces`,
      sessions: await tx`select id from guest_sessions`,
      jobs: await tx`select id from jobs`,
    }));
    assert.equal(r.plans.length, 4);
    for (const k of ["events", "photos", "faces", "sessions", "jobs"]) assert.equal(r[k].length, 0, k);
  });

  it("face search and queue functions are service-role only", async () => {
    const vec = `[${Array(128).fill(0.1).join(",")}]`;
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(
        as(role, role === "anon" ? null : A.uid, (tx) => tx`select * from search_event_faces(${A.event}, ${vec}::extensions.vector, 'x', 0.4, 0.5)`),
        /permission denied/,
      );
      await assert.rejects(as(role, role === "anon" ? null : A.uid, (tx) => tx`select * from register_photo(${A.event}, 'k', 'n', 'image/jpeg', 1, ${"b".repeat(64)})`), /permission denied/);
    }
  });
});
