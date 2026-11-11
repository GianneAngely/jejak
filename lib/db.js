/* Jejak: Postgres layer (Neon via @vercel/postgres).
   Multi-akun dari awal: setiap baris punya user_id, setiap query memfilter user_id. */
const { sql } = require("@vercel/postgres");
const crypto = require("crypto");

function newId() { return crypto.randomBytes(9).toString("base64url"); }

let inited = false;
async function ensureInit() {
  if (inited) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY, email text UNIQUE, pw_hash text, name text,
    claim_code text, created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY, user_id text NOT NULL, created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS trips (
    id text PRIMARY KEY, user_id text NOT NULL, title text NOT NULL,
    start_date text NOT NULL, end_date text NOT NULL, place text DEFAULT '',
    tz text DEFAULT 'WIB', day_notes jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS entries (
    id text PRIMARY KEY, trip_id text NOT NULL, user_id text NOT NULL,
    kind text NOT NULL DEFAULT 'out', category text NOT NULL DEFAULT 'Lain-lain',
    title text NOT NULL, amount bigint NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'paid',
    date text, note text DEFAULT '', flag text DEFAULT '', proofs jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS stops (
    id text PRIMARY KEY, trip_id text NOT NULL, user_id text NOT NULL,
    day text NOT NULL, start_t text DEFAULT '', end_t text DEFAULT '',
    title text NOT NULL, place text DEFAULT '', maps_url text DEFAULT '', note text DEFAULT '',
    sort int DEFAULT 0, created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS moments (
    id text PRIMARY KEY, trip_id text NOT NULL, user_id text NOT NULL,
    day text NOT NULL, url text NOT NULL, caption text DEFAULT '',
    created_at timestamptz DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS trips_user ON trips(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS entries_trip ON entries(trip_id)`;
  await sql`CREATE INDEX IF NOT EXISTS stops_trip ON stops(trip_id)`;
  await sql`CREATE INDEX IF NOT EXISTS moments_trip ON moments(trip_id)`;
  inited = true;
}

/* tabel anak trip: kolom yang boleh diisi dari klien */
const TABLES = {
  entries: ["kind", "category", "title", "amount", "status", "date", "note", "flag", "proofs"],
  stops: ["day", "start_t", "end_t", "title", "place", "maps_url", "note", "sort"],
  moments: ["day", "url", "caption"]
};
const JSONCOLS = { proofs: 1 };

function clean(table, b) {
  const out = {};
  TABLES[table].forEach(k => {
    if (b[k] === undefined) return;
    let v = b[k];
    if (k === "amount") v = Math.max(0, Math.round(Number(v) || 0));
    else if (k === "sort") v = Math.round(Number(v) || 0);
    else if (JSONCOLS[k]) v = JSON.stringify(Array.isArray(v) ? v.slice(0, 20) : []);
    else v = String(v == null ? "" : v).slice(0, k === "note" || k === "caption" ? 2000 : 300);
    out[k] = v;
  });
  return out;
}

async function q(text, params) { await ensureInit(); const r = await sql.query(text, params); return r.rows; }

/* users + sessions */
async function getUserByEmail(email) { return (await q("SELECT * FROM users WHERE email=$1", [email]))[0] || null; }
async function getUserById(id) { return (await q("SELECT * FROM users WHERE id=$1", [id]))[0] || null; }
async function getUserByClaim(code) { return (await q("SELECT * FROM users WHERE claim_code=$1 AND email IS NULL", [code]))[0] || null; }
async function createUser(u) {
  const id = newId();
  await q("INSERT INTO users (id,email,pw_hash,name) VALUES ($1,$2,$3,$4)", [id, u.email, u.pw_hash, u.name]);
  return { id: id, email: u.email, name: u.name };
}
async function claimUser(id, u) {
  await q("UPDATE users SET email=$2, pw_hash=$3, name=COALESCE($4,name), claim_code=NULL WHERE id=$1", [id, u.email, u.pw_hash, u.name]);
}
/* kode undangan untuk akun yang sudah ada: pindahkan isi akun siapan ke akun ini */
async function mergeClaim(code, uid) {
  const pre = await getUserByClaim(code);
  if (!pre || pre.id === uid) return false;
  for (const t of ["trips", "entries", "stops", "moments"]) await q("UPDATE " + t + " SET user_id=$2 WHERE user_id=$1", [pre.id, uid]);
  await q("DELETE FROM users WHERE id=$1 AND email IS NULL", [pre.id]);
  return true;
}
async function createSession(uid, th) { await q("INSERT INTO sessions (token,user_id) VALUES ($1,$2)", [th, uid]); }
async function userIdBySession(th) { return ((await q("SELECT user_id FROM sessions WHERE token=$1", [th]))[0] || {}).user_id || null; }
async function delSession(th) { await q("DELETE FROM sessions WHERE token=$1", [th]); }

/* trips */
async function listTrips(uid) {
  return q(`SELECT t.id, t.title, t.start_date, t.end_date, t.place, t.tz,
      COALESCE(SUM(CASE WHEN e.kind='in' THEN e.amount END),0)::bigint AS total_in,
      COALESCE(SUM(CASE WHEN e.kind='out' AND e.status='paid' THEN e.amount END),0)::bigint AS total_paid,
      COALESCE(SUM(CASE WHEN e.kind='out' AND e.status='plan' THEN e.amount END),0)::bigint AS total_plan
    FROM trips t LEFT JOIN entries e ON e.trip_id=t.id
    WHERE t.user_id=$1 GROUP BY t.id ORDER BY t.start_date DESC`, [uid]);
}
async function getTrip(uid, id) {
  const t = (await q("SELECT * FROM trips WHERE id=$1 AND user_id=$2", [id, uid]))[0];
  if (!t) return null;
  const [entries, stops, moments] = await Promise.all([
    q("SELECT * FROM entries WHERE trip_id=$1 AND user_id=$2 ORDER BY date NULLS LAST, created_at", [id, uid]),
    q("SELECT * FROM stops WHERE trip_id=$1 AND user_id=$2 ORDER BY day, start_t, sort, created_at", [id, uid]),
    q("SELECT * FROM moments WHERE trip_id=$1 AND user_id=$2 ORDER BY day, created_at", [id, uid])
  ]);
  entries.forEach(e => { e.amount = Number(e.amount); });
  return Object.assign(t, { entries: entries, stops: stops, moments: moments });
}
function tripFields(b) {
  const o = {};
  ["title", "start_date", "end_date", "place", "tz"].forEach(k => { if (b[k] !== undefined) o[k] = String(b[k] || "").slice(0, 200); });
  if (b.day_notes !== undefined && typeof b.day_notes === "object") o.day_notes = JSON.stringify(b.day_notes);
  return o;
}
async function createTrip(uid, b) {
  const f = tripFields(b), id = newId();
  if (!f.title || !f.start_date || !f.end_date) throw Object.assign(new Error("bad"), { code: 400 });
  await q("INSERT INTO trips (id,user_id,title,start_date,end_date,place,tz) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, uid, f.title, f.start_date, f.end_date, f.place || "", f.tz || "WIB"]);
  return { id: id };
}
async function updateTrip(uid, id, b) {
  const f = tripFields(b), keys = Object.keys(f);
  if (!keys.length) return;
  const set = keys.map((k, i) => k + "=$" + (i + 3) + (k === "day_notes" ? "::jsonb" : "")).join(",");
  await q("UPDATE trips SET " + set + " WHERE id=$1 AND user_id=$2", [id, uid].concat(keys.map(k => f[k])));
}
async function deleteTrip(uid, id) {
  await q("DELETE FROM entries WHERE trip_id=$1 AND user_id=$2", [id, uid]);
  await q("DELETE FROM stops WHERE trip_id=$1 AND user_id=$2", [id, uid]);
  await q("DELETE FROM moments WHERE trip_id=$1 AND user_id=$2", [id, uid]);
  await q("DELETE FROM trips WHERE id=$1 AND user_id=$2", [id, uid]);
}
async function ownsTrip(uid, id) { return !!(await q("SELECT 1 FROM trips WHERE id=$1 AND user_id=$2", [id, uid]))[0]; }

/* item generik (entries / stops / moments) */
async function createItem(uid, table, tripId, b) {
  if (!TABLES[table]) throw Object.assign(new Error("bad table"), { code: 400 });
  if (!(await ownsTrip(uid, tripId))) throw Object.assign(new Error("not found"), { code: 404 });
  const f = clean(table, b), id = newId();
  const keys = ["id", "trip_id", "user_id"].concat(Object.keys(f));
  const vals = [id, tripId, uid].concat(Object.keys(f).map(k => f[k]));
  const ph = keys.map((k, i) => "$" + (i + 1) + (JSONCOLS[k] ? "::jsonb" : "")).join(",");
  const row = (await q("INSERT INTO " + table + " (" + keys.join(",") + ") VALUES (" + ph + ") RETURNING *", vals))[0];
  if (row.amount !== undefined) row.amount = Number(row.amount);
  return row;
}
async function updateItem(uid, table, id, b) {
  if (!TABLES[table]) throw Object.assign(new Error("bad table"), { code: 400 });
  const f = clean(table, b), keys = Object.keys(f);
  if (!keys.length) return null;
  const set = keys.map((k, i) => k + "=$" + (i + 3) + (JSONCOLS[k] ? "::jsonb" : "")).join(",");
  const row = (await q("UPDATE " + table + " SET " + set + " WHERE id=$1 AND user_id=$2 RETURNING *", [id, uid].concat(keys.map(k => f[k]))))[0];
  if (row && row.amount !== undefined) row.amount = Number(row.amount);
  return row || null;
}
async function deleteItem(uid, table, id) {
  if (!TABLES[table]) throw Object.assign(new Error("bad table"), { code: 400 });
  await q("DELETE FROM " + table + " WHERE id=$1 AND user_id=$2", [id, uid]);
}

module.exports = {
  ensureInit, q, newId,
  getUserByEmail, getUserById, getUserByClaim, createUser, claimUser, mergeClaim,
  createSession, userIdBySession, delSession,
  listTrips, getTrip, createTrip, updateTrip, deleteTrip,
  createItem, updateItem, deleteItem
};
