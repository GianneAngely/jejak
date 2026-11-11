/* /api/upload
   POST { data: base64 JPEG/PNG/WebP (sudah dikompres di HP), kind: "bukti"|"diari" } -> { url }
   DELETE ?url=  -> hapus file milik akun ini dari Blob */
const { put, del } = require("@vercel/blob");
const auth = require("../lib/auth");
const crypto = require("crypto");

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

module.exports = async function (req, res) {
  const uid = await auth.requireUser(req, res);
  if (!uid) return;
  try {
    if (req.method === "POST") {
      const b = req.body || {};
      const type = TYPES[b.type] ? b.type : "image/jpeg";
      const buf = Buffer.from(String(b.data || ""), "base64");
      if (!buf.length || buf.length > 4 * 1024 * 1024) { res.status(400).json({ error: "bad-file" }); return; }
      const kind = b.kind === "diari" ? "diari" : "bukti";
      const name = "u/" + uid + "/" + kind + "/" + crypto.randomBytes(12).toString("hex") + "." + TYPES[type];
      const blob = await put(name, buf, { access: "public", contentType: type, addRandomSuffix: false });
      res.json({ url: blob.url });
      return;
    }
    if (req.method === "DELETE") {
      const url = String((req.query || {}).url || "");
      if (url.indexOf("/u/" + uid + "/") < 0) { res.status(403).json({ error: "forbidden" }); return; }
      await del(url);
      res.json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method" });
  } catch (e) { console.error("upload", e); res.status(500).json({ error: "server" }); }
};
