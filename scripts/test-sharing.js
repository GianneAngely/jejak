/* Uji otorisasi berbagi perjalanan. Memanggil handler API langsung (in-process) dengan
   sesi asli di DB, memakai tiga akun tes yang dibuat dan dihapus oleh skrip ini.
   Jalankan: node --env-file=.env.local scripts/test-sharing.js */
const crypto = require("crypto");
const db = require("../lib/db");
const auth = require("../lib/auth");
const H = { auth: require("../api/auth"), trips: require("../api/trips"), items: require("../api/items"), upload: require("../api/upload") };

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("  ok  " + name); } else { fail++; console.log("  GAGAL " + name); } }

async function call(h, user, method, query, body) {
  const res = { code: 200, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  await H[h]({ method: method, query: query || {}, body: body || {}, headers: { cookie: user ? user.cookie : "" } }, res);
  return res;
}
async function mkUser(tag) {
  const u = await db.createUser({ email: "tes-" + tag + "-" + crypto.randomBytes(3).toString("hex") + "@example.test", pw_hash: auth.hashPassword("x".repeat(12)), name: "Tes " + tag });
  const res = { setHeader(k, v) { this.c = v; } };
  await auth.startSession(res, u.id);
  u.cookie = String(res.c).split(";")[0];
  return u;
}

(async () => {
  await db.ensureInit();
  const A = await mkUser("pemilik"), B = await mkUser("anggota"), C = await mkUser("luar");
  const users = [A, B, C];
  try {
    const t1 = (await call("trips", A, "POST", {}, { title: "Trip bersama", start_date: "2026-11-12", end_date: "2026-11-15" })).body.id;
    const t2 = (await call("trips", A, "POST", {}, { title: "Trip pribadi", start_date: "2026-12-01", end_date: "2026-12-02" })).body.id;
    const eA = (await call("items", A, "POST", { t: "entries" }, { trip_id: t1, title: "Bus", amount: 590000, proofs: [{ url: "https://x.public.blob.vercel-storage.com/u/" + A.id + "/bukti/a.jpg" }] })).body.item;
    const sA = (await call("items", A, "POST", { t: "stops" }, { trip_id: t1, day: "2026-11-13", title: "Registrasi" })).body.item;

    console.log("Bukan anggota (C):");
    ok((await call("trips", C, "GET", { id: t1 })).code === 404, "tidak bisa membaca perjalanan");
    ok(!(await call("trips", C, "GET")).body.trips.some(t => t.id === t1), "perjalanan tidak muncul di daftar");
    ok((await call("items", C, "POST", { t: "entries" }, { trip_id: t1, title: "x", amount: 1 })).code === 404, "tidak bisa menambah transaksi");
    ok((await call("items", C, "PATCH", { t: "entries", id: eA.id }, { amount: 1 })).code === 404, "tidak bisa mengubah transaksi");
    ok((await call("items", C, "DELETE", { t: "stops", id: sA.id })).code === 404, "tidak bisa menghapus agenda");
    ok((await call("trips", C, "PATCH", { id: t1 }, { day_notes: { a: "x" } })).code === 404, "tidak bisa menulis cerita harian");
    ok((await call("trips", C, "POST", { id: t1 }, { action: "invite" })).code === 403, "tidak bisa membuat kode ajakan");
    ok((await call("upload", C, "DELETE", { url: eA.proofs[0].url })).code === 403, "tidak bisa menghapus foto bukti");
    ok((await call("trips", null, "GET", { id: t1 })).code === 401, "tanpa login ditolak");

    console.log("Kode ajakan:");
    const code = (await call("trips", A, "POST", { id: t1 }, { action: "invite" })).body.code;
    ok(/^[A-Z2-9]{8}$/.test(code), "pemilik membuat kode");
    ok((await call("auth", B, "POST", {}, { action: "claim", code: "SALAH123" })).code === 400, "kode salah ditolak");
    ok((await call("auth", B, "POST", {}, { action: "claim", code: code })).body.trip_id === t1, "kode benar menjadikan anggota");

    console.log("Anggota (B):");
    const gB = (await call("trips", B, "GET", { id: t1 })).body.trip;
    ok(gB && gB.role === "member" && gB.entries.length === 1, "bisa membaca perjalanan dan transaksi");
    ok(gB && gB.invite_code === undefined, "tidak melihat kode ajakan");
    ok(gB && gB.members.length === 2 && gB.entries[0].by_name === "Tes pemilik", "melihat daftar anggota dan pencatat");
    const lB = (await call("trips", B, "GET")).body.trips;
    ok(lB.some(t => t.id === t1) && !lB.some(t => t.id === t2), "daftar berisi perjalanan bersama saja");
    ok((await call("trips", B, "GET", { id: t2 })).code === 404, "tidak bisa membaca perjalanan lain milik pemilik");
    const eB = (await call("items", B, "POST", { t: "entries" }, { trip_id: t1, title: "Makan", amount: 40000 })).body.item;
    ok(eB && eB.user_id === B.id, "bisa menambah transaksi (tercatat atas namanya)");
    ok((await call("items", B, "PATCH", { t: "entries", id: eA.id }, { status: "paid", note: "dicek" })).body.item.note === "dicek", "bisa mengubah transaksi pemilik");
    ok((await call("items", B, "POST", { t: "moments" }, { trip_id: t1, day: "2026-11-13", url: "https://x/u/" + B.id + "/diari/b.jpg" })).code === 200, "bisa menambah foto diari");
    ok((await call("items", B, "PATCH", { t: "stops", id: sA.id }, { note: "lt 5" })).code === 200, "bisa mengubah jadwal");
    ok((await call("trips", B, "PATCH", { id: t1 }, { day_notes: { "2026-11-13": "seru" } })).code === 200, "bisa menulis cerita harian");
    ok((await call("trips", B, "PATCH", { id: t1 }, { title: "Ganti" })).code === 403, "tidak bisa mengubah judul/tanggal");
    ok((await call("items", B, "DELETE", { t: "entries", id: eA.id })).code === 403, "tidak bisa menghapus catatan pemilik");
    ok((await call("items", B, "DELETE", { t: "entries", id: eB.id })).code === 200, "bisa menghapus catatannya sendiri");
    ok((await call("trips", B, "DELETE", { id: t1 })).code === 403, "tidak bisa menghapus perjalanan");
    ok((await call("trips", B, "POST", { id: t1 }, { action: "invite" })).code === 403, "tidak bisa membuat/mengganti kode");
    ok((await call("trips", B, "POST", { id: t1 }, { action: "kick", user_id: A.id })).code === 403, "tidak bisa mengeluarkan anggota");
    ok((await call("upload", B, "DELETE", { url: eA.proofs[0].url })).code === 403, "tidak bisa menghapus berkas foto milik pemilik");

    console.log("Pemilik (A):");
    ok((await call("trips", A, "GET", { id: t1 })).body.trip.invite_code === code, "melihat kode ajakan");
    ok((await call("trips", A, "PATCH", { id: t1 }, { title: "Trip bersama 2" })).code === 200, "bisa mengubah judul");
    await call("trips", A, "POST", { id: t1 }, { action: "revoke" });
    ok((await call("auth", C, "POST", {}, { action: "claim", code: code })).code === 400, "kode yang dicabut ditolak");
    ok((await call("trips", C, "GET", { id: t1 })).code === 404, "pengguna luar tetap tidak berakses setelah mencoba kode lama");
    await call("trips", A, "POST", { id: t1 }, { action: "kick", user_id: B.id });
    ok((await call("trips", B, "GET", { id: t1 })).code === 404, "anggota yang dikeluarkan kehilangan akses");
    ok((await call("items", B, "POST", { t: "stops" }, { trip_id: t1, day: "2026-11-13", title: "x" })).code === 404, "anggota yang dikeluarkan tidak bisa menulis");
    ok((await call("trips", A, "DELETE", { id: t1 })).code === 200, "pemilik bisa menghapus perjalanan");
    await call("trips", A, "DELETE", { id: t2 });
  } catch (e) { fail++; console.error("ERROR", e); }
  finally {
    for (const u of users) {
      for (const t of await db.q("SELECT id FROM trips WHERE user_id=$1", [u.id])) await db.deleteTrip(u.id, t.id);
      await db.q("DELETE FROM trip_members WHERE user_id=$1", [u.id]);
      await db.q("DELETE FROM sessions WHERE user_id=$1", [u.id]);
      await db.q("DELETE FROM users WHERE id=$1", [u.id]);
    }
  }
  console.log("\n" + pass + " lulus, " + fail + " gagal");
  process.exit(fail ? 1 : 0);
})();
