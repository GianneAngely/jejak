/* AI (opsional): hanya Gemini, aktif kalau GEMINI_API_KEY diisi pemilik app.
   Tanpa key, fitur AI mati dan app tetap jalan. Sengaja tidak memakai Claude API. */
const CATS = ["Transport", "Penginapan", "Makan", "Cetak", "Lain-lain"];

function enabled() { return !!process.env.GEMINI_API_KEY; }

function extractJSON(text) {
  const t = String(text || ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

async function gemini(parts, json, maxTokens) {
  const model = (process.env.AI_MODEL && /^gemini/.test(process.env.AI_MODEL)) ? process.env.AI_MODEL : "gemini-flash-latest";
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + process.env.GEMINI_API_KEY, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: parts }], generationConfig: Object.assign({ temperature: json ? 0 : 0.6, maxOutputTokens: maxTokens }, json ? { responseMimeType: "application/json" } : {}) })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("gemini", r.status, JSON.stringify(j).slice(0, 300)); return null; }
  return (((j.candidates || [])[0] || {}).content || {}).parts ? j.candidates[0].content.parts.map(p => p.text || "").join("") : null;
}
async function run(prompt, image, json, maxTokens) {
  if (process.env.GEMINI_API_KEY) {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: image.type, data: image.data } });
    return gemini(parts, json, maxTokens);
  }
  return null;
}

const SCAN_PROMPT =
  "Kamu membaca struk/nota/kuitansi/bukti transfer Indonesia. Keluarkan HANYA JSON valid tanpa teks lain:\n" +
  '{"title": nama toko/penjual atau isi transaksi singkat, "date": "YYYY-MM-DD" atau null, "total": integer rupiah tanpa titik, ' +
  '"category": salah satu ' + JSON.stringify(CATS) + "}\n" +
  "Ambil total akhir yang dibayar (sesudah pajak & diskon). Ojek/taksi online/bus/tiket = Transport, hotel = Penginapan, " +
  "makanan/minuman = Makan, print/banner/fotokopi = Cetak. Kalau bukan struk atau total tidak terbaca, keluarkan {\"total\": null}.";

async function scan(image) {
  const out = extractJSON(await run(SCAN_PROMPT, image, true, 1024));
  if (!out || !out.total || !isFinite(Number(out.total))) return null;
  return {
    title: String(out.title || "Struk").slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || "") ? out.date : null,
    amount: Math.round(Number(out.total)),
    category: CATS.indexOf(out.category) >= 0 ? out.category : "Lain-lain"
  };
}

async function advise(summary) {
  const prompt = "Kamu teman yang bantu atur dana perjalanan lomba/dinas. Data perjalanan di bawah sudah dihitung, jangan hitung ulang angka totalnya. " +
    "Beri 3 sampai 4 saran singkat dan konkret (pakai angka rupiah), mis. batas makan per hari, pos yang perlu dicek, dan pengingat bukti struk yang belum ada. " +
    "Bahasa Indonesia santai, kalimat pendek, tanpa em dash, tanpa emoji, tanpa heading. Format: tiap saran satu baris diawali '- '.\n\n" + summary;
  const t = await run(prompt, null, false, 600);
  return t ? t.trim() : null;
}

module.exports = { enabled, scan, advise, CATS };
