/* Server demo lokal untuk tangkapan layar README.
   Melayani halaman dan aset dari repo seperti di Vercel, lalu menjawab API dengan satu
   perjalanan contoh fiktif dari memori. Tidak menyentuh basis data atau Blob, dan semua
   perubahan dari layar hanya berlaku sampai server dimatikan.

     node scripts/demo-server.js            (http://localhost:4321)
     PORT=5000 node scripts/demo-server.js

   Buka http://localhost:4321/app?lang=en untuk antarmuka bahasa Inggris. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const brand = require("../api/brand");
const PORT = +process.env.PORT || 4321;

const ME = { id: "u_demo", email: "demo@jejak.app", name: "Gianne" };
const MATE = { id: "u_mate", name: "Yoga" };
const now = new Date();
const day = (o) => { const d = new Date(now); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
const proof = (f) => [{ url: "/demo/" + f, ts: now.toISOString() }];
const id = () => crypto.randomBytes(6).toString("hex");

let entries = [
  { kind: "in", category: "Dana kampus", title: "Campus competition grant", amount: 2500000, status: "paid", date: day(-2), note: "Must be reported with receipts.", by: ME },
  { kind: "out", category: "Transport", title: "Train to Surabaya, executive class (2 people)", amount: 480000, status: "paid", date: day(-1), proofs: proof("train.jpg"), by: ME },
  { kind: "out", category: "Penginapan", title: "Hotel Mawar, 2 nights", amount: 620000, status: "paid", date: day(-1), proofs: proof("hotel.jpg"), by: MATE },
  { kind: "out", category: "Cetak", title: "X-banner and stand for the booth", amount: 70000, status: "paid", date: day(-1), proofs: proof("print.jpg"), by: ME },
  { kind: "out", category: "Makan", title: "Team lunch near campus", amount: 90000, status: "paid", date: day(0), proofs: proof("lunch.jpg"), by: ME },
  { kind: "out", category: "Transport", title: "Ride to the venue", amount: 28500, status: "paid", date: day(0), by: MATE },
  { kind: "out", category: "Transport", title: "Train home (2 people)", amount: 480000, status: "plan", date: day(1), by: ME },
  { kind: "out", category: "Makan", title: "Meals for the last day", amount: 150000, status: "plan", date: day(1), by: ME }
].map((e, i) => ({ id: "e" + i, trip_id: "demo", user_id: e.by.id, by_name: e.by.name, note: "", flag: "", proofs: [], created_at: now.toISOString(), ...e, by: undefined }));

let stops = [
  [-1, "07:40", "", "Train to Surabaya", "Gubeng Station"],
  [-1, "14:00", "", "Hotel check-in", "Hotel Mawar"],
  [-1, "17:00", "", "Pick up the X-banner", "Print Centre"],
  [0, "07:00", "08:00", "Registration", "Tower 2, campus"],
  [0, "15:08", "15:31", "Final presentation and live demo", "Room 903, Tower 2"],
  [1, "09:00", "11:30", "Exhibition booth", "Tower 2 lobby"],
  [1, "15:30", "17:30", "Awards", "Main hall"]
].map((s, i) => ({ id: "s" + i, trip_id: "demo", user_id: ME.id, day: day(s[0]), start_t: s[1], end_t: s[2], title: s[3], place: s[4], maps_url: "https://maps.google.com/?q=" + encodeURIComponent(s[4]), note: "", sort: i, created_at: now.toISOString() }));

let notes = [{
  id: "n1", trip_id: "demo", user_id: ME.id, by_name: ME.name, sort: 0, created_at: now.toISOString(), title: "Q&A practice",
  body: [
    "# Q&A practice",
    "Answer in one sentence first, then add one or two sentences of detail.",
    "%% Product",
    "??? Who is the app for?",
    "[Gianne]",
    "Students and staff who travel on a grant and have to report every expense with receipts.",
    "??? What happens when there is no signal?",
    "[Yoga]",
    "Notes that were opened once stay readable offline, and new entries are sent as soon as the phone is back online.",
    "%% Budget",
    "??? How is the daily meal allowance calculated?",
    "[Gianne]",
    "Remaining funds minus planned costs, divided by the days left in the trip."
  ].join("\n")
}];

const trip = () => ({
  id: "demo", user_id: ME.id, title: "App competition final, Surabaya", start_date: day(-1), end_date: day(1), place: "Surabaya",
  tz: "WIB", day_notes: {}, invite_code: "JJK4TEAM", created_at: now.toISOString(),
  entries, stops, moments: [], notes, role: "owner", me: ME.id,
  members: [{ id: ME.id, name: ME.name, role: "owner" }, { id: MATE.id, name: MATE.name, role: "member" }]
});
const sum = (f) => entries.filter(f).reduce((s, e) => s + e.amount, 0);

const TYPES = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".html": "text/html; charset=utf-8" };
const STATIC = { "/app.js": "web/app.js", "/app.css": "web/app.css", "/sw.js": "web/sw.js", "/icon.svg": "web/icon.svg", "/icon-512.png": "web/icon-512.png", "/apple-touch-icon.png": "web/apple-touch-icon.png" };

function send(res, code, body, type) { res.writeHead(code, { "Content-Type": type || "application/json" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
function file(res, rel) {
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) return send(res, 404, { error: "not-found" });
  send(res, 200, fs.readFileSync(p), TYPES[path.extname(p)] || "application/octet-stream");
}
function body(req) { return new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { ok({}); } }); }); }
function brandCall(req, res, query) {
  req.query = query;
  res.json = (o) => send(res, 200, o);
  brand(req, res);
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const q = Object.fromEntries(u.searchParams);
  const p = u.pathname;
  if (p === "/") return brandCall(req, res, { f: "page", p: "landing" });
  if (p === "/app") return brandCall(req, res, { f: "page", p: "app" });
  if (p === "/brand.js") return brandCall(req, res, {});
  if (p === "/manifest.webmanifest") return brandCall(req, res, { f: "manifest" });
  if (STATIC[p]) return file(res, STATIC[p]);
  if (p.startsWith("/demo/")) return file(res, "scripts/demo/" + path.basename(p));

  if (p === "/api/auth") return send(res, 200, req.method === "GET" ? ME : { ok: true });
  if (p === "/api/ai") return send(res, 200, { enabled: false });
  if (p === "/api/trips") {
    if (req.method === "GET" && !q.id) {
      const t = trip();
      return send(res, 200, { trips: [{ id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date, place: t.place, tz: t.tz, owner_name: ME.name, role: "owner",
        total_in: sum((e) => e.kind === "in"), total_paid: sum((e) => e.kind === "out" && e.status === "paid"), total_plan: sum((e) => e.kind === "out" && e.status === "plan") }] });
    }
    if (req.method === "GET") return q.id === "demo" ? send(res, 200, { trip: trip() }) : send(res, 404, { error: "not-found" });
    return send(res, 200, { ok: true, code: "JJK4TEAM" });
  }
  if (p === "/api/items") {
    const b = await body(req);
    const list = { entries, stops, moments: [] }[q.t];
    if (!list) return send(res, 400, { error: "bad" });
    if (req.method === "POST") { const row = { id: id(), user_id: ME.id, by_name: ME.name, proofs: [], created_at: new Date().toISOString(), ...b }; list.push(row); return send(res, 200, row); }
    const i = list.findIndex((r) => r.id === q.id);
    if (i < 0) return send(res, 404, { error: "not-found" });
    if (req.method === "PATCH") { Object.assign(list[i], b); return send(res, 200, { ok: true }); }
    if (req.method === "DELETE") { list.splice(i, 1); return send(res, 200, { ok: true }); }
  }
  if (p === "/api/upload") return send(res, 200, { url: "/demo/lunch.jpg" });
  send(res, 404, { error: "not-found" });
}).listen(PORT, () => console.log("Jejak demo: http://localhost:" + PORT + "/app?lang=en"));
