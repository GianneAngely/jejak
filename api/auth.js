/* /api/auth
   GET  -> akun yang sedang masuk (atau 401)
   POST { action: "signup" | "login" | "logout", email, password, name, code } */
const db = require("../lib/db");
const auth = require("../lib/auth");

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

module.exports = async function (req, res) {
  try {
    if (req.method === "GET") {
      const uid = await auth.requireUser(req, res);
      if (!uid) return;
      const u = await db.getUserById(uid);
      if (!u) { res.status(401).json({ error: "unauthorized" }); return; }
      res.json({ id: u.id, email: u.email, name: u.name });
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
    const b = req.body || {};
    if (b.action === "logout") { await auth.endSession(req, res); res.json({ ok: true }); return; }
    if (b.action === "claim") {                       // kode undangan setelah punya akun
      const uid = await auth.requireUser(req, res);
      if (!uid) return;
      const ok = await db.mergeClaim(String(b.code || "").trim().toUpperCase(), uid);
      if (!ok) { res.status(400).json({ error: "bad-code" }); return; }
      res.json({ ok: true });
      return;
    }
    const email = String(b.email || "").trim().toLowerCase();
    const pw = String(b.password || "");
    if (b.action === "login") {
      const u = email ? await db.getUserByEmail(email) : null;
      if (!u || !auth.verifyPassword(pw, u.pw_hash)) { res.status(401).json({ error: "bad-login" }); return; }
      await auth.startSession(res, u.id);
      res.json({ ok: true });
      return;
    }
    if (b.action === "signup") {
      const name = String(b.name || "").trim().slice(0, 60) || null;
      if (!EMAIL.test(email)) { res.status(400).json({ error: "bad-email" }); return; }
      if (pw.length < 8) { res.status(400).json({ error: "weak-password" }); return; }
      if (await db.getUserByEmail(email)) { res.status(409).json({ error: "email-taken" }); return; }
      const code = String(b.code || "").trim().toUpperCase();
      let uid;
      if (code) {                                   // kode undangan: ambil alih akun yang sudah disiapkan
        const pre = await db.getUserByClaim(code);
        if (!pre) { res.status(400).json({ error: "bad-code" }); return; }
        await db.claimUser(pre.id, { email: email, pw_hash: auth.hashPassword(pw), name: name });
        uid = pre.id;
      } else {
        uid = (await db.createUser({ email: email, pw_hash: auth.hashPassword(pw), name: name })).id;
      }
      await auth.startSession(res, uid);
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ error: "bad-action" });
  } catch (e) { console.error("auth api", e); res.status(500).json({ error: "server" }); }
};
