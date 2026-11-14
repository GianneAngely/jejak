/* /api/img?id=  -> gambar catatan.
   Hanya anggota perjalanan yang boleh membuka (cek sesi + keanggotaan). Gambar disimpan di DB,
   tidak di Blob publik, jadi tidak ada tautan yang bisa dibuka tanpa masuk. */
const db = require("../lib/db");
const auth = require("../lib/auth");

module.exports = async function (req, res) {
  const uid = await auth.requireUser(req, res);
  if (!uid) return;
  try {
    if (req.method !== "GET") { res.status(405).json({ error: "method" }); return; }
    const id = String((req.query || {}).id || "");
    const im = /^[a-f0-9]{16,64}$/.test(id) ? await db.getNoteImage(uid, id) : null;
    if (!im) { res.status(404).json({ error: "not-found" }); return; }
    res.setHeader("Content-Type", im.mime);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(im.buf);
  } catch (e) { console.error("img", e); res.status(500).json({ error: "server" }); }
};
