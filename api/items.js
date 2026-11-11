/* /api/items?t=entries|stops|moments
   POST   { trip_id, ...fields } -> buat
   PATCH  ?id= { ...fields }     -> ubah
   DELETE ?id=                   -> hapus */
const db = require("../lib/db");
const auth = require("../lib/auth");

module.exports = async function (req, res) {
  const uid = await auth.requireUser(req, res);
  if (!uid) return;
  const qy = req.query || {}, t = String(qy.t || ""), id = String(qy.id || "");
  const b = req.body || {};
  try {
    if (req.method === "POST") { res.json({ item: await db.createItem(uid, t, String(b.trip_id || ""), b) }); return; }
    if (req.method === "PATCH" && id) { res.json({ item: await db.updateItem(uid, t, id, b) }); return; }
    if (req.method === "DELETE" && id) { await db.deleteItem(uid, t, id); res.json({ ok: true }); return; }
    res.status(405).json({ error: "method" });
  } catch (e) {
    if (e.code) { res.status(e.code).json({ error: e.message }); return; }
    console.error("items", e); res.status(500).json({ error: "server" });
  }
};
