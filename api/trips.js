/* /api/trips
   GET            -> daftar perjalanan + ringkasan dana
   GET ?id=       -> satu perjalanan lengkap (entries, stops, moments)
   POST {..}      -> buat perjalanan
   PATCH ?id= {..}-> ubah (judul, tanggal, tempat, day_notes)
   DELETE ?id=    -> hapus beserta isinya */
const db = require("../lib/db");
const auth = require("../lib/auth");

module.exports = async function (req, res) {
  const uid = await auth.requireUser(req, res);
  if (!uid) return;
  const id = String((req.query || {}).id || "");
  try {
    if (req.method === "GET") {
      if (!id) { res.json({ trips: (await db.listTrips(uid)).map(t => Object.assign(t, { total_in: +t.total_in, total_paid: +t.total_paid, total_plan: +t.total_plan })) }); return; }
      const t = await db.getTrip(uid, id);
      if (!t) { res.status(404).json({ error: "not-found" }); return; }
      res.json({ trip: t });
      return;
    }
    if (req.method === "POST") { res.json(await db.createTrip(uid, req.body || {})); return; }
    if (req.method === "PATCH" && id) { await db.updateTrip(uid, id, req.body || {}); res.json({ ok: true }); return; }
    if (req.method === "DELETE" && id) { await db.deleteTrip(uid, id); res.json({ ok: true }); return; }
    res.status(405).json({ error: "method" });
  } catch (e) {
    if (e.code) { res.status(e.code).json({ error: e.message }); return; }
    console.error("trips", e); res.status(500).json({ error: "server" });
  }
};
