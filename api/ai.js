/* /api/ai
   GET                                  -> { enabled }
   POST { action:"scan", type, data }   -> { result: {title,date,amount,category} | null }
   POST { action:"advise", trip_id }    -> { text } */
const ai = require("../lib/ai");
const db = require("../lib/db");
const auth = require("../lib/auth");

function rp(n) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function todayWIB() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }

function summary(t) {
  const sum = f => t.entries.filter(f).reduce((a, e) => a + e.amount, 0);
  const inn = sum(e => e.kind === "in"), paid = sum(e => e.kind === "out" && e.status === "paid"), plan = sum(e => e.kind === "out" && e.status === "plan");
  const lines = t.entries.map(e => `${e.kind === "in" ? "MASUK" : "KELUAR"} | ${e.status === "plan" ? "rencana" : "dibayar"} | ${e.category} | ${e.title} | ${rp(e.amount)} | bukti ${(e.proofs || []).length}${e.flag ? " | " + e.flag : ""}`);
  return [
    `Perjalanan: ${t.title}, ${t.start_date} s/d ${t.end_date}${t.place ? ", " + t.place : ""}. Hari ini ${todayWIB()}.`,
    `Dana masuk ${rp(inn)}. Sudah dibayar ${rp(paid)}. Masih rencana ${rp(plan)}. Sisa sekarang ${rp(inn - paid)}. Sisa kalau semua rencana dibayar ${rp(inn - paid - plan)}.`,
    "Transaksi:", lines.join("\n") || "(kosong)"
  ].join("\n");
}

module.exports = async function (req, res) {
  if (req.method === "GET") { res.json({ enabled: ai.enabled() }); return; }
  const uid = await auth.requireUser(req, res);
  if (!uid) return;
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  if (!ai.enabled()) { res.status(503).json({ error: "ai-off" }); return; }
  const b = req.body || {};
  try {
    if (b.action === "scan") {
      const type = /^image\/(jpeg|png|webp)$/.test(b.type || "") ? b.type : "image/jpeg";
      res.json({ result: await ai.scan({ type: type, data: String(b.data || "") }) });
      return;
    }
    if (b.action === "advise") {
      const t = await db.getTrip(uid, String(b.trip_id || ""));
      if (!t) { res.status(404).json({ error: "not-found" }); return; }
      res.json({ text: await ai.advise(summary(t)) });
      return;
    }
    res.status(400).json({ error: "bad-action" });
  } catch (e) { console.error("ai", e); res.status(500).json({ error: "server" }); }
};
