/* Jejak: auth. Sesi per akun lewat cookie httpOnly; hanya sha256 token yang disimpan.
   Sandi akun di-hash scrypt. */
const crypto = require("crypto");
const db = require("./db");

const SESS = "jejak_sess";
const MAXAGE = 60 * 60 * 24 * 180;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return "scrypt$" + salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("hex");
}
function verifyPassword(pw, stored) {
  if (!stored || stored.indexOf("scrypt$") !== 0) return false;
  const p = stored.split("$");
  const calc = crypto.scryptSync(String(pw), p[1], 32), want = Buffer.from(p[2], "hex");
  return calc.length === want.length && crypto.timingSafeEqual(calc, want);
}
function getCookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function setCookie(res, v, age) {
  res.setHeader("Set-Cookie", SESS + "=" + v + "; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=" + age);
}
function th(t) { return crypto.createHash("sha256").update(String(t)).digest("hex"); }

async function startSession(res, uid) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.createSession(uid, th(token));
  setCookie(res, token, MAXAGE);
}
async function endSession(req, res) {
  const t = getCookie(req, SESS);
  if (t) { try { await db.delSession(th(t)); } catch (e) {} }
  setCookie(res, "", 0);
}
async function requireUser(req, res) {
  try {
    const t = getCookie(req, SESS);
    const uid = t ? await db.userIdBySession(th(t)) : null;
    if (uid) return uid;
  } catch (e) { console.error("auth", e); res.status(500).json({ error: "server" }); return null; }
  res.status(401).json({ error: "unauthorized" });
  return null;
}

module.exports = { hashPassword, verifyPassword, startSession, endSession, requireUser };
