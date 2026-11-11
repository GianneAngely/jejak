/* Jejak: app satu halaman, tanpa framework. Rute lewat hash:
   #/                     daftar perjalanan
   #/t/:id/dana|rundown (Jadwal)|diari|lapor (Laporan)
   #/t/:id/diari/:day     detail satu hari
   #/lapor/:id            laporan siap cetak (PDF) */
(function () {
  "use strict";
  var $app = document.getElementById("app");
  var BRAND = (window.BRAND && window.BRAND.name) || "";
  var S = { me: null, trips: null, trip: null, ai: false, day: null, files: {} };

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rp(n) { n = Math.round(Number(n) || 0); return (n < 0 ? "−Rp" : "Rp") + Math.abs(n).toLocaleString("id-ID"); }
  function digits(s) { return Number(String(s || "").replace(/\D/g, "")) || 0; }
  function todayWIB() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function tzOff(t) { return { WIB: 7, WITA: 8, WIT: 9 }[(t && t.tz) || "WIB"] || 7; }
  function nowIn(t) { return new Date(Date.now() + tzOff(t) * 3600e3).toISOString().slice(0, 16); }
  function dObj(d) { return new Date(d + "T00:00:00Z"); }
  function fmtDay(d, opt) { return dObj(d).toLocaleDateString("id-ID", Object.assign({ timeZone: "UTC" }, opt || { weekday: "short", day: "numeric", month: "short" })); }
  function addDays(d, n) { var x = dObj(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function tripDays(t) { var out = [], d = t.start_date; while (d <= t.end_date && out.length < 60) { out.push(d); d = addDays(d, 1); } return out; }
  function hhmm(s) { return s ? s.replace(":", ".") : ""; }

  var I = {
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    nav: '<path d="M3 11l18-8-8 18-2-8z"/>', clip: '<path d="M20 11.5l-8.3 8.3a5 5 0 01-7-7L13 4.5a3.4 3.4 0 014.8 4.8l-8.3 8.3a1.7 1.7 0 01-2.4-2.4L14.8 7.5"/>',
    menu: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10"/>',
    dl: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/>', spark: '<path d="M12 3l1.8 6.2L20 12l-6.2 1.8L12 20l-1.8-6.2L4 12l6.2-2.8z"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/>',
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
    food: '<path d="M7 3v8a2 2 0 002 2v8M11 3v8M7 7h4M17 21V3c-2 1-3 4-3 8h3"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', dot: '<circle cx="12" cy="12" r="3"/>', coin: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.9 1 1.8 2.5 1.8 2.5-.7 2.5-1.7M12 6.5v1.3M12 16.2v1.3"/>'
  };
  function ic(n, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + I[n] + "</svg>"; }

  var OUT_CATS = ["Transport", "Penginapan", "Makan", "Cetak", "Lain-lain"];
  var IN_CATS = ["Dana kampus", "Sponsor", "Pribadi", "Lain-lain"];
  var CAT_IC = { Transport: "bus", Penginapan: "bed", Makan: "food", Cetak: "print" };

  function toast(msg, ms) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 2400);
  }
  async function api(path, opt) {
    opt = opt || {};
    var r = await fetch(path, { method: opt.method || "GET", headers: opt.body ? { "content-type": "application/json" } : {}, body: opt.body ? JSON.stringify(opt.body) : undefined, credentials: "same-origin" });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401 && path.indexOf("/api/auth") !== 0) { S.me = null; renderAuth(); throw new Error("unauthorized"); }
    if (!r.ok) { var e = new Error(j.error || "gagal"); e.status = r.status; throw e; }
    return j;
  }

  /* ---------- gambar: kompres, unggah, simpan ke galeri ---------- */
  function readImage(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { ok({ img: img, url: url }); };
      img.onerror = function () { bad(new Error("Gambar tidak bisa dibaca")); };
      img.src = url;
    });
  }
  async function compress(file, max) {
    var r = await readImage(file), img = r.img, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, (max || 1600) / Math.max(w, h));
    var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(r.url);
    var data = c.toDataURL("image/jpeg", 0.82);
    return { type: "image/jpeg", data: data.slice(data.indexOf(",") + 1), preview: data };
  }
  async function uploadFile(file, kind) {
    var c = await compress(file, 1600);
    var j = await api("/api/upload", { method: "POST", body: { type: c.type, data: c.data, kind: kind } });
    S.files[j.url] = file;           // simpan file asli di memori untuk tombol "Simpan ke galeri"
    return { url: j.url, compressed: c };
  }
  /* Web tidak bisa menulis langsung ke galeri. Jalan terbaik: lembar Bagikan sistem
     (iPhone: "Simpan Gambar"; Android: Galeri/Foto/Files), kalau tidak ada, unduh file. */
  async function saveToGallery(url) {
    try {
      var file = S.files[url];
      if (!file) {
        var r = await fetch(url); var b = await r.blob();
        file = new File([b], "bukti-" + Date.now() + ".jpg", { type: b.type || "image/jpeg" });
      } else if (!file.name || file.name === "image.jpg") {
        file = new File([file], "bukti-" + Date.now() + ".jpg", { type: file.type || "image/jpeg" });
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      toast("Foto sudah diunduh. Periksa folder Download atau galeri.");
    } catch (e) { if (e && e.name !== "AbortError") toast("Foto gagal disimpan."); }
  }
  function pickFiles(opt) {
    return new Promise(function (ok) {
      var i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
      if (opt.camera) i.setAttribute("capture", "environment");
      if (opt.multiple) i.multiple = true;
      i.style.display = "none"; document.body.appendChild(i);
      i.onchange = function () { ok(Array.prototype.slice.call(i.files || [])); i.remove(); };
      i.click();
    });
  }

  /* ---------- sheet ---------- */
  var $sheet = document.getElementById("sheet"), $card = $sheet.querySelector(".sheet-card");
  function openSheet(html) { $card.innerHTML = html; $sheet.hidden = false; document.body.style.overflow = "hidden"; $card.scrollTop = 0; return $card; }
  function closeSheet() { $sheet.hidden = true; $card.innerHTML = ""; document.body.style.overflow = ""; }
  $sheet.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close") || e.target.closest("[data-close]")) closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$sheet.hidden) closeSheet(); });

  /* ---------- hitungan dana ---------- */
  function totals(t) {
    var o = { in: 0, paid: 0, plan: 0, cats: {}, noProof: [] };
    (t.entries || []).forEach(function (e) {
      if (e.kind === "in") { o.in += e.amount; return; }
      o[e.status === "plan" ? "plan" : "paid"] += e.amount;
      var c = o.cats[e.category] = o.cats[e.category] || { paid: 0, plan: 0 };
      c[e.status === "plan" ? "plan" : "paid"] += e.amount;
      if (e.status === "paid" && !(e.proofs || []).length) o.noProof.push(e);
    });
    o.left = o.in - o.paid; o.after = o.left - o.plan;
    return o;
  }

  /* ---------- auth ---------- */
  function renderAuth(mode) {
    mode = mode || "login";
    var signup = mode === "signup";
    $app.innerHTML =
      '<div class="auth"><div class="brand">' + esc(BRAND) + '<b>.</b></div>' +
      '<p class="lead">Catat dana perjalanan, simpan foto struk, dan susun jadwal di satu tempat. Laporan pertanggungjawaban siap dicetak sepulang dinas atau lomba.</p>' +
      '<div class="seg" style="margin-bottom:20px"><button data-m="login" class="' + (!signup ? "on" : "") + '">Masuk</button><button data-m="signup" class="' + (signup ? "on" : "") + '">Daftar</button></div>' +
      '<form id="af">' +
      (signup ? '<div class="f"><label for="nm">Nama</label><input class="in-t" id="nm" autocomplete="name" placeholder="Nama yang tercantum di laporan"></div>' : "") +
      '<div class="f"><label for="em">Email</label><input class="in-t" id="em" type="email" autocomplete="email" required></div>' +
      '<div class="f"><label for="pw">Kata sandi</label><input class="in-t" id="pw" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" required minlength="' + (signup ? 8 : 1) + '">' + (signup ? '<span class="hint">Minimal 8 karakter.</span>' : "") + '</div>' +
      (signup ? '<div id="codeBox" hidden class="f"><label for="cd">Kode undangan</label><input class="in-t mono" id="cd" autocapitalize="characters" autocomplete="off" placeholder="Boleh dikosongkan"><span class="hint">Kode undangan berisi data perjalanan yang sudah disiapkan untukmu.</span></div><button type="button" class="link-btn" id="codeT">Punya kode undangan?</button>' : "") +
      '<div class="err" id="ae"></div><button class="btn pri block" type="submit">' + (signup ? "Buat akun" : "Masuk") + '</button></form>' +
      '<p class="hint" style="margin-top:18px">' + (signup ? 'Sudah punya akun? <button type="button" class="link-btn" data-m="login">Masuk di sini</button>' : 'Belum punya akun? <button type="button" class="link-btn" data-m="signup">Daftar gratis</button>') + "</p></div>";
    $app.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { renderAuth(b.dataset.m); }; });
    var ct = document.getElementById("codeT");
    if (ct) ct.onclick = function () { document.getElementById("codeBox").hidden = false; ct.remove(); document.getElementById("cd").focus(); };
    document.getElementById("af").onsubmit = async function (e) {
      e.preventDefault();
      var btn = e.target.querySelector("button[type=submit]"), er = document.getElementById("ae");
      btn.disabled = true; er.textContent = "";
      var body = { action: mode, email: document.getElementById("em").value, password: document.getElementById("pw").value };
      if (signup) { body.name = document.getElementById("nm").value; body.code = (document.getElementById("cd") || {}).value || ""; }
      try { await api("/api/auth", { method: "POST", body: body }); await boot(); }
      catch (x) {
        er.textContent = { "bad-login": "Email atau kata sandi salah.", "email-taken": "Email ini sudah terdaftar. Silakan masuk.", "weak-password": "Kata sandi minimal 8 karakter.", "bad-email": "Format email belum benar.", "bad-code": "Kode undangan tidak dikenal atau sudah dipakai." }[x.message] || "Koneksi gagal. Periksa sinyal, lalu coba lagi.";
        btn.disabled = false;
      }
    };
  }

  /* ---------- karcis (kartu ringkasan) ---------- */
  function karcis(t, tot, big) {
    var days = tripDays(t).length;
    return '<div class="karcis"><div class="k-top"><div class="k-eyebrow"><span>' + esc(fmtDay(t.start_date, { day: "numeric", month: "short" })) + " – " + esc(fmtDay(t.end_date, { day: "numeric", month: "short", year: "numeric" })) + '</span><span>' + days + " hari · " + esc(t.tz || "WIB") + '</span></div>' +
      '<div class="k-title">' + esc(t.title) + '</div>' + (t.place ? '<div class="k-route">' + ic("pin", ' width="14" height="14"') + esc(t.place) + '</div>' : "") + '</div>' +
      '<div class="k-bot"><div class="k-eyebrow"><span>Sisa dana</span></div><div class="k-big' + (tot.left < 0 ? " neg" : "") + '">' + rp(tot.left) + '</div>' +
      '<div class="k-sub">Dana masuk ' + rp(tot.in) + " · terpakai " + rp(tot.paid) + "</div>" +
      (big && tot.plan ? '<div class="k-after">Setelah semua rencana dibayar: <b class="mono' + (tot.after < 0 ? " neg" : "") + '">' + rp(tot.after) + "</b></div>" : "") +
      "</div></div>";
  }

  /* ---------- beranda: daftar perjalanan ---------- */
  function stepsHTML(items) {
    return '<ol class="steps">' + items.map(function (s, i) {
      return '<li class="' + (s.done ? "done" : "") + '"><span class="n">' + (s.done ? ic("check") : i + 1) + '</span><span class="tx"><b>' + s.t + "</b>" + (s.d ? "<small>" + s.d + "</small>" : "") + "</span>" + (!s.done && s.btn ? '<button class="btn sm' + (s.pri ? " pri" : "") + '" data-step="' + i + '">' + s.btn + "</button>" : "") + "</li>";
    }).join("") + "</ol>";
  }
  async function renderHome() {
    $app.innerHTML = '<div class="wrap"><div class="top"><h1>' + esc(BRAND) + '<b>.</b></h1><button class="btn sm ghost" id="acc">Akun</button></div><div id="tl" class="muted">Memuat…</div></div>';
    document.getElementById("acc").onclick = accountSheet;
    var j = await api("/api/trips"); S.trips = j.trips;
    var el = document.getElementById("tl");
    if (!j.trips.length) {
      el.innerHTML = '<div class="welcome"><h2>Selamat datang' + (S.me && S.me.name ? ", " + esc(S.me.name) : "") + '.</h2><p>Mulai dalam tiga langkah berikut.</p>' +
        stepsHTML([{ t: "Buat perjalanan", d: "Nama acara, kota, dan tanggal.", btn: "Buat perjalanan", pri: true }, { t: "Catat dana masuk", d: "Dana dari kampus, kantor, atau sponsor." }, { t: "Foto struk setiap membayar", d: "Bukti langsung tersimpan untuk laporan." }]) + "</div>" +
        '<p class="hint" style="margin-top:14px">Punya kode undangan? Buka menu <b>Akun</b> di kanan atas.</p>';
      el.querySelector("[data-step]").onclick = function () { tripSheet(null); };
      return;
    }
    el.innerHTML = '<div class="sec" style="margin-top:4px">Perjalanan saya</div>' +
      j.trips.map(function (t) { return '<a class="trip-link" href="#/t/' + t.id + '/dana">' + karcis(t, { in: t.total_in, paid: t.total_paid, plan: t.total_plan, left: t.total_in - t.total_paid }, false) + "</a>"; }).join("") +
      '<button class="btn block" id="nt">' + ic("plus") + "Buat perjalanan baru</button>";
    document.getElementById("nt").onclick = function () { tripSheet(null); };
  }
  function accountSheet() {
    var c = openSheet('<h2>Akun</h2><p class="muted" style="margin:-8px 0 18px">' + esc(S.me.name || "") + (S.me.email ? " · " + esc(S.me.email) : "") + "</p>" +
      '<form id="cf" class="f"><label for="cc">Kode undangan</label><div class="btns"><input class="in-t mono" id="cc" autocapitalize="characters" autocomplete="off" placeholder="Masukkan kode" style="flex:2"><button class="btn" type="submit">Pakai kode</button></div><span class="hint">Data perjalanan dari kode akan dipindahkan ke akun ini.</span><span class="err" id="ce"></span></form>' +
      '<div class="menu-list"><a class="btn ghost block" href="/">Buka halaman depan</a><button class="btn danger block" id="lo">Keluar dari akun</button></div>');
    c.querySelector("#cf").onsubmit = async function (e) {
      e.preventDefault();
      var code = c.querySelector("#cc").value.trim();
      if (!code) return;
      try { await api("/api/auth", { method: "POST", body: { action: "claim", code: code } }); closeSheet(); toast("Kode berhasil dipakai. Datanya sudah masuk ke akunmu."); location.hash = "#/"; route(); }
      catch (x) { c.querySelector("#ce").textContent = "Kode tidak dikenal atau sudah dipakai."; }
    };
    c.querySelector("#lo").onclick = async function () { await api("/api/auth", { method: "POST", body: { action: "logout" } }); closeSheet(); S.me = null; location.hash = "#/"; renderAuth(); };
  }
  function tripSheet(t) {
    var c = openSheet("<h2>" + (t ? "Ubah perjalanan" : "Perjalanan baru") + '</h2><form id="tf">' +
      '<div class="f"><label for="tt">Nama perjalanan</label><input class="in-t" id="tt" required placeholder="Contoh: Final lomba desain di Bandung" value="' + esc(t ? t.title : "") + '"></div>' +
      '<div class="f"><label for="tp">Kota atau tempat</label><input class="in-t" id="tp" placeholder="Contoh: Institut Teknologi Bandung" value="' + esc(t ? t.place : "") + '"></div>' +
      '<div class="two"><div class="f"><label for="ts">Tanggal mulai</label><input class="in-t" id="ts" type="date" required value="' + esc(t ? t.start_date : todayWIB()) + '"></div><div class="f"><label for="te">Tanggal selesai</label><input class="in-t" id="te" type="date" required value="' + esc(t ? t.end_date : todayWIB()) + '"></div></div>' +
      '<div class="f"><span class="lbl">Zona waktu di tujuan</span><div class="seg" id="tz">' + ["WIB", "WITA", "WIT"].map(function (z) { return '<button type="button" data-z="' + z + '" class="' + ((t ? t.tz : "WIB") === z ? "on" : "") + '">' + z + "</button>"; }).join("") + "</div></div>" +
      '<div class="err" id="te2"></div><button class="btn pri block" type="submit">' + (t ? "Simpan perubahan" : "Buat perjalanan") + "</button>" +
      (t ? '<button type="button" class="btn danger block" id="td" style="margin-top:10px">Hapus perjalanan</button>' : "") + "</form>");
    var tz = t ? t.tz : "WIB";
    c.querySelectorAll("[data-z]").forEach(function (b) { b.onclick = function () { tz = b.dataset.z; c.querySelectorAll("[data-z]").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    c.querySelector("#tf").onsubmit = async function (e) {
      e.preventDefault();
      var body = { title: c.querySelector("#tt").value.trim(), place: c.querySelector("#tp").value.trim(), start_date: c.querySelector("#ts").value, end_date: c.querySelector("#te").value, tz: tz };
      if (body.end_date < body.start_date) { c.querySelector("#te2").textContent = "Tanggal selesai tidak boleh sebelum tanggal mulai."; return; }
      e.target.querySelector("button[type=submit]").disabled = true;
      if (t) { await api("/api/trips?id=" + t.id, { method: "PATCH", body: body }); closeSheet(); await loadTrip(t.id); route(); toast("Perubahan tersimpan"); }
      else { var j = await api("/api/trips", { method: "POST", body: body }); closeSheet(); location.hash = "#/t/" + j.id + "/dana"; }
    };
    if (t) c.querySelector("#td").onclick = async function () {
      if (!confirm('Hapus "' + t.title + '" beserta semua transaksi, jadwal, dan diari? Tindakan ini tidak bisa dibatalkan.')) return;
      await api("/api/trips?id=" + t.id, { method: "DELETE" }); closeSheet(); S.trip = null; location.hash = "#/";
    };
  }

  /* ---------- kerangka perjalanan ---------- */
  async function loadTrip(id) { var j = await api("/api/trips?id=" + id); S.trip = j.trip; S.trip.day_notes = S.trip.day_notes || {}; return S.trip; }
  function shell(t, tab, inner, fab) {
    var tabs = [["dana", "Dana", "wallet"], ["rundown", "Jadwal", "route"], ["diari", "Diari", "img"], ["lapor", "Laporan", "doc"]];
    $app.innerHTML = '<div class="wrap"><div class="top"><a class="back" href="#/" aria-label="Semua perjalanan">' + ic("back", ' width="18" height="18"') + '</a><span class="top-t">' + esc(t.title) + '</span><button class="btn sm ghost" id="te">Ubah</button></div>' + inner + "</div>" +
      (fab ? '<button class="fab" id="fab">' + ic("plus") + "<span>" + esc(fab) + "</span></button>" : "") +
      '<nav class="tabbar" aria-label="Menu perjalanan"><div class="in">' + tabs.map(function (x) { return '<a href="#/t/' + t.id + "/" + x[0] + '" class="' + (tab === x[0] ? "on" : "") + '"' + (tab === x[0] ? ' aria-current="page"' : "") + ">" + ic(x[2]) + x[1] + "</a>"; }).join("") + "</div></nav>";
    document.getElementById("te").onclick = function () { tripSheet(t); };
  }

  /* ---------- DANA ---------- */
  function entryRow(e) {
    var isIn = e.kind === "in", n = (e.proofs || []).length, plan = e.status === "plan";
    var proof = isIn ? "" : (n ? '<span class="tag ok">' + ic("clip") + n + " foto bukti</span>" : (plan ? "" : '<span class="tag warn">' + ic("clip") + "Belum ada foto bukti</span>"));
    return '<button class="row" data-e="' + e.id + '"><span class="ic' + (isIn ? " in" : "") + '">' + ic(isIn ? "coin" : (CAT_IC[e.category] || "dot")) + '</span><span class="mid"><span class="t">' + esc(e.title) + '</span><span class="s">' +
      "<span>" + esc(e.category) + (e.date ? " · " + esc(fmtDay(e.date, { day: "numeric", month: "short" })) : "") + "</span>" + proof +
      (e.flag ? '<span class="flag">' + esc(e.flag) + "</span>" : "") + '</span></span><span class="amt' + (isIn ? " in" : "") + '">' + (isIn ? "+" : "") + rp(e.amount) + "</span></button>";
  }
  function listBlock(title, list, empty) {
    var sum = list.reduce(function (a, e) { return a + e.amount; }, 0);
    return '<div class="sec">' + title + '<span class="act mono">' + (list.length ? rp(sum) : "") + "</span></div>" + (list.length ? '<div class="list">' + list.map(entryRow).join("") + "</div>" : '<div class="empty">' + empty + "</div>");
  }
  function renderDana(t) {
    var tot = totals(t), days = tripDays(t), today = nowIn(t).slice(0, 10);
    var left = days.filter(function (d) { return d >= today; }).length;
    var ins = t.entries.filter(function (e) { return e.kind === "in"; });
    var outs = t.entries.filter(function (e) { return e.kind === "out"; });
    var paid = outs.filter(function (e) { return e.status !== "plan"; }), plan = outs.filter(function (e) { return e.status === "plan"; });
    var hasProof = outs.some(function (e) { return (e.proofs || []).length; });
    var html = karcis(t, tot, true);
    var steps = [
      { t: "Catat dana masuk", d: "Dana dari kampus, kantor, atau sponsor.", done: ins.length > 0, btn: "Catat", act: function () { entrySheet(null, "in"); } },
      { t: "Catat pengeluaran pertama", d: "Tiket, penginapan, makan, atau cetak.", done: outs.length > 0, btn: "Catat", act: function () { entrySheet(null, "out"); } },
      { t: "Lampirkan foto bukti", d: "Foto struk, nota, atau tiket.", done: hasProof, btn: "Foto struk", act: quickPhoto }
    ];
    if (steps.some(function (s) { return !s.done; })) html += '<div class="card-box"><div class="cb-h">Langkah awal</div>' + stepsHTML(steps.map(function (s, i) { var o = Object.assign({}, s); o.pri = !s.done && steps.slice(0, i).every(function (x) { return x.done; }); return o; })) + "</div>";
    html += '<div class="qa"><button class="btn pri" id="qPhoto">' + ic("cam") + 'Foto struk</button><button class="btn" id="qManual">' + ic("plus") + "Catat manual</button></div>";
    if (tot.noProof.length) html += '<a class="warn-card" href="#/t/' + t.id + '/lapor">' + ic("clip") + "<span><b>" + tot.noProof.length + " pengeluaran belum punya foto bukti.</b> Ketuk untuk melihat daftarnya.</span></a>";
    if (left && tot.in) {
      var makanPlan = (tot.cats.Makan || {}).plan || 0;
      var perDay = Math.max(0, Math.floor((tot.after + makanPlan) / left / 1000) * 1000);
      html += '<div class="note-card"><div class="cb-h">Batas aman makan</div><b class="mono big-n">' + rp(perDay) + '</b> per hari selama ' + left + " hari tersisa.<div class=\"hint\" style=\"margin-top:6px\">Angka ini sudah memperhitungkan semua rencana selain makan.</div>" +
        (S.ai ? '<div><button class="btn sm ghost" id="adv" style="margin-top:10px">' + ic("spark") + 'Minta saran anggaran</button></div><div class="ai-out" id="advo"></div>' : "") + "</div>";
    }
    html += listBlock("Sudah dibayar", paid, "Belum ada pengeluaran yang dibayar. Ketuk <b>Foto struk</b> setiap kali membayar.");
    if (plan.length) html += listBlock("Rencana, belum dibayar", plan, "");
    html += listBlock("Dana masuk", ins, "Catat dana dari kampus, kantor, atau sponsor agar sisa dana terhitung.");
    if (Object.keys(tot.cats).length) {
      var maxCat = Math.max.apply(null, [1].concat(Object.keys(tot.cats).map(function (k) { return tot.cats[k].paid + tot.cats[k].plan; })));
      html += '<div class="sec">Per kategori</div><div class="cats">' + OUT_CATS.concat(Object.keys(tot.cats).filter(function (k) { return OUT_CATS.indexOf(k) < 0; })).filter(function (k) { return tot.cats[k]; }).map(function (k) {
        var c = tot.cats[k];
        return '<div class="cat-row"><span>' + esc(k) + '</span><span class="bar"><i class="p" style="width:' + (c.paid / maxCat * 100) + '%"></i><i class="r" style="width:' + (c.plan / maxCat * 100) + '%"></i></span><span class="mono" style="font-size:12.5px">' + rp(c.paid + c.plan) + "</span></div>";
      }).join("") + '<div class="legend"><span><i class="p"></i>Sudah dibayar</span><span><i class="r"></i>Rencana</span></div></div>';
    }
    shell(t, "dana", html, "");
    document.getElementById("qPhoto").onclick = quickPhoto;
    document.getElementById("qManual").onclick = function () { entrySheet(null, "out"); };
    $app.querySelectorAll("[data-step]").forEach(function (b) { b.onclick = steps[+b.dataset.step].act; });
    $app.querySelectorAll("[data-e]").forEach(function (b) { b.onclick = function () { entrySheet(t.entries.find(function (e) { return e.id === b.dataset.e; })); }; });
    var adv = document.getElementById("adv");
    if (adv) adv.onclick = async function () {
      adv.disabled = true; adv.innerHTML = ic("spark") + "Sedang menghitung…";
      try { var j = await api("/api/ai", { method: "POST", body: { action: "advise", trip_id: t.id } }); document.getElementById("advo").textContent = j.text || "Saran belum tersedia. Coba lagi sebentar."; }
      catch (e) { document.getElementById("advo").textContent = "Saran belum bisa dibuat sekarang."; }
      adv.disabled = false; adv.innerHTML = ic("spark") + "Minta saran lagi";
    };
  }
  /* jalur tercepat: kamera dulu, lalu isi nominal & keterangan */
  async function quickPhoto() {
    var files = await pickFiles({ camera: true });
    if (!files.length) return;
    entrySheet(null, "out", { files: files, cam: true });
  }

  function entrySheet(e, kind, pre) {
    var t = S.trip, isNew = !e;
    var today = nowIn(t).slice(0, 10);
    var st = e ? Object.assign({}, e, { proofs: (e.proofs || []).slice() }) : { kind: kind || "out", category: kind === "in" ? "Dana kampus" : "Makan", title: "", amount: 0, status: "paid", date: today >= t.start_date && today <= t.end_date ? today : today, note: "", flag: "", proofs: [] };
    var isIn = function () { return st.kind === "in"; };
    var c = openSheet('<h2>' + (isNew ? (st.kind === "in" ? "Catat dana masuk" : "Catat pengeluaran") : "Ubah transaksi") + '</h2><form id="ef">' +
      '<div class="seg" id="kd" style="margin-bottom:14px"><button type="button" data-k="out" class="out">Pengeluaran</button><button type="button" data-k="in" class="in">Dana masuk</button></div>' +
      '<div class="f"><label for="ea">Nominal</label><input class="in-t in-amt" id="ea" inputmode="numeric" autocomplete="off" placeholder="Rp0"></div>' +
      '<div class="f"><label for="et">Keterangan</label><input class="in-t" id="et" required></div>' +
      '<div class="f" id="pf"><span class="lbl">Foto bukti</span><div class="btns"><button type="button" class="btn sm" id="pc">' + ic("cam") + 'Ambil foto</button><button type="button" class="btn sm" id="pg">' + ic("img") + "Pilih dari galeri</button>" + (S.ai ? '<button type="button" class="btn sm" id="ps">' + ic("scan") + "Baca struk</button>" : "") + '</div><div class="proofs" id="pp"></div><span class="hint" id="ph"></span></div>' +
      '<div class="f" id="sw"><span class="lbl">Status pembayaran</span><div class="seg" id="es"><button type="button" data-s="paid">Sudah dibayar</button><button type="button" data-s="plan">Belum, masih rencana</button></div></div>' +
      '<div class="f"><span class="lbl">Kategori</span><div class="chips" id="ec"></div></div>' +
      '<details class="more"' + (e && (e.note || e.flag) ? " open" : "") + '><summary>Tanggal dan catatan</summary>' +
      '<div class="f"><label for="ed">Tanggal</label><input class="in-t" id="ed" type="date"></div>' +
      '<div class="f"><label for="en">Catatan</label><textarea class="in-t" id="en" placeholder="Boleh dikosongkan"></textarea></div>' +
      (e && e.flag ? '<div class="f"><label for="ef2">Tanda perlu dicek</label><input class="in-t" id="ef2"><span class="hint">Kosongkan jika sudah beres.</span></div>' : "") + "</details>" +
      '<div class="err" id="ee"></div><div class="save-bar"><button class="btn pri block" type="submit">Simpan</button></div>' + (isNew ? "" : '<button type="button" class="btn danger block" id="edel" style="margin-top:10px">Hapus transaksi</button>') + "</form>");
    var $a = c.querySelector("#ea");
    function setAmt(v) { $a.value = v ? "Rp" + Number(v).toLocaleString("id-ID") : ""; }
    $a.oninput = function () { var p = $a.selectionStart, L = $a.value.length; setAmt(digits($a.value)); var d = $a.value.length - L; try { $a.setSelectionRange(p + d, p + d); } catch (x) {} };
    setAmt(st.amount);
    c.querySelector("#et").value = st.title; c.querySelector("#ed").value = st.date || ""; c.querySelector("#en").value = st.note || "";
    if (c.querySelector("#ef2")) c.querySelector("#ef2").value = st.flag || "";
    function paint() {
      c.querySelector("h2").textContent = isNew ? (isIn() ? "Catat dana masuk" : "Catat pengeluaran") : "Ubah transaksi";
      c.querySelector("#et").placeholder = isIn() ? "Contoh: Dana lomba dari kampus" : "Contoh: Ojek daring ke hotel";
      c.querySelectorAll("[data-k]").forEach(function (b) { b.classList.toggle("on", b.dataset.k === st.kind); });
      var cats = isIn() ? IN_CATS : OUT_CATS;
      if (cats.indexOf(st.category) < 0 && !(e && e.kind === st.kind)) st.category = cats[0];
      if (cats.indexOf(st.category) < 0) cats = cats.concat(st.category);
      c.querySelector("#ec").innerHTML = cats.map(function (k) { return '<button type="button" class="chip' + (k === st.category ? " on" : "") + '" data-c="' + esc(k) + '">' + esc(k) + "</button>"; }).join("");
      c.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { st.category = b.dataset.c; paint(); }; });
      c.querySelector("#sw").hidden = isIn();
      c.querySelector("#pf .lbl").textContent = isIn() ? "Foto bukti (opsional)" : "Foto bukti";
      c.querySelectorAll("[data-s]").forEach(function (b) { b.classList.toggle("on", b.dataset.s === st.status); });
    }
    c.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { st.kind = b.dataset.k; if (isIn()) st.status = "paid"; paint(); }; });
    c.querySelectorAll("[data-s]").forEach(function (b) { b.onclick = function () { st.status = b.dataset.s; paint(); }; });
    paint();

    var $pp = c.querySelector("#pp"), $ph = c.querySelector("#ph"), pending = 0, fromCam = {}, removed = [];
    function paintProofs() {
      $pp.innerHTML = st.proofs.map(function (p, i) { return '<div class="proof"><a href="' + esc(p.url) + '" target="_blank" rel="noopener"><img src="' + esc(p.url) + '" alt="Foto bukti ' + (i + 1) + '" loading="lazy"></a><button type="button" class="x" data-x="' + i + '" aria-label="Hapus foto bukti">' + ic("x") + '</button><button type="button" class="sv" data-sv="' + i + '">' + (fromCam[p.url] ? "Simpan ke galeri" : "Unduh") + "</button></div>"; }).join("") +
        Array(pending + 1).join('<div class="proof loading"></div>');
      $pp.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () { if (confirm("Hapus foto bukti ini?")) { var p = st.proofs.splice(+b.dataset.x, 1)[0]; removed.push(p.url); paintProofs(); } }; });
      $pp.querySelectorAll("[data-sv]").forEach(function (b) { b.onclick = function () { saveToGallery(st.proofs[+b.dataset.sv].url); }; });
      $ph.textContent = pending ? "Mengunggah foto…" : (Object.keys(fromCam).length ? "Foto dari kamera tidak otomatis masuk galeri HP. Ketuk \"Simpan ke galeri\" untuk menyimpan cadangan." : "");
    }
    async function addProofs(files, cam, scan) {
      for (var i = 0; i < files.length; i++) {
        pending++; paintProofs();
        try {
          var f = files[i];
          var up = uploadFile(f, "bukti");
          var sc = scan && S.ai ? api("/api/ai", { method: "POST", body: { action: "scan", type: "image/jpeg", data: (await compress(f, 1400)).data } }).catch(function () { return {}; }) : null;
          var r = await up;
          st.proofs.push({ url: r.url, ts: new Date().toISOString() });
          if (cam) fromCam[r.url] = 1;
          if (sc) {
            var res = (await sc).result;
            if (res) {
              setAmt(res.amount); st.category = res.category; if (res.date) c.querySelector("#ed").value = res.date;
              if (!c.querySelector("#et").value) c.querySelector("#et").value = res.title;
              st.kind = "out"; st.status = "paid"; paint(); toast("Struk berhasil dibaca. Periksa kembali nominalnya.");
            } else toast("Struk tidak terbaca. Isi nominal secara manual.");
          }
        } catch (x) { toast("Foto gagal diunggah. Coba lagi."); }
        pending--; paintProofs();
      }
    }
    c.querySelector("#pc").onclick = async function () { addProofs(await pickFiles({ camera: true }), true, false); };
    c.querySelector("#pg").onclick = async function () { addProofs(await pickFiles({ multiple: true }), false, false); };
    if (c.querySelector("#ps")) c.querySelector("#ps").onclick = async function () { addProofs(await pickFiles({}), false, true); };
    paintProofs();
    if (pre && pre.files) { addProofs(pre.files, pre.cam, S.ai); setTimeout(function () { $a.focus(); }, 300); }

    c.querySelector("#ef").onsubmit = async function (ev) {
      ev.preventDefault();
      var er = c.querySelector("#ee");
      if (pending) { er.textContent = "Tunggu sampai foto selesai diunggah."; return; }
      var body = { kind: st.kind, category: st.category, title: c.querySelector("#et").value.trim(), amount: digits($a.value), status: isIn() ? "paid" : st.status, date: c.querySelector("#ed").value || null, note: c.querySelector("#en").value, proofs: st.proofs };
      if (c.querySelector("#ef2")) body.flag = c.querySelector("#ef2").value.trim();
      if (!body.amount) { er.textContent = "Nominal belum diisi."; $a.focus(); return; }
      if (!body.title) { er.textContent = "Keterangan belum diisi."; c.querySelector("#et").focus(); return; }
      ev.target.querySelector("button[type=submit]").disabled = true;
      try {
        if (isNew) { body.trip_id = t.id; var j = await api("/api/items?t=entries", { method: "POST", body: body }); t.entries.push(j.item); }
        else { var j2 = await api("/api/items?t=entries&id=" + e.id, { method: "PATCH", body: body }); Object.assign(e, j2.item); }
        removed.forEach(function (u) { api("/api/upload?url=" + encodeURIComponent(u), { method: "DELETE" }).catch(function () {}); });
        closeSheet(); renderDana(t); toast(isNew ? "Transaksi tercatat" : "Perubahan tersimpan");
      } catch (x) { er.textContent = "Gagal menyimpan. Periksa sinyal, lalu coba lagi."; ev.target.querySelector("button[type=submit]").disabled = false; }
    };
    if (!isNew) c.querySelector("#edel").onclick = async function () {
      if (!confirm('Hapus "' + e.title + '"? Foto buktinya ikut terhapus.')) return;
      await api("/api/items?t=entries&id=" + e.id, { method: "DELETE" });
      (e.proofs || []).forEach(function (p) { api("/api/upload?url=" + encodeURIComponent(p.url), { method: "DELETE" }).catch(function () {}); });
      t.entries = t.entries.filter(function (x) { return x.id !== e.id; }); closeSheet(); renderDana(t); toast("Transaksi terhapus");
    };
  }

  /* ---------- JADWAL ---------- */
  function mapsUrl(s) { return s.maps_url || (s.place ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.place) : ""); }
  function dirUrl(a, b) { return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(a) + "&destination=" + encodeURIComponent(b); }
  function renderRundown(t) {
    var days = tripDays(t), today = nowIn(t).slice(0, 10), now = nowIn(t).slice(11, 16);
    var extra = t.stops.map(function (s) { return s.day; }).filter(function (d, i, a) { return days.indexOf(d) < 0 && a.indexOf(d) === i; });
    days = days.concat(extra).sort();
    if (!S.day || days.indexOf(S.day) < 0) S.day = days.indexOf(today) >= 0 ? today : days[0];
    var list = t.stops.filter(function (s) { return s.day === S.day; }).sort(function (a, b) { return (a.start_t || "99").localeCompare(b.start_t || "99") || a.sort - b.sort; });
    var nowIdx = -1;
    if (S.day === today) list.forEach(function (s, i) { if (s.start_t && s.start_t <= now) nowIdx = i; });
    var html = '<div class="days">' + days.map(function (d) { return '<button class="day-chip' + (d === S.day ? " on" : "") + '" data-d="' + d + '"><b>' + esc(fmtDay(d, { weekday: "long" })) + "</b><small>" + esc(fmtDay(d, { day: "numeric", month: "short" })) + "</small></button>"; }).join("") + "</div>";
    if (!list.length) html += '<div class="empty" style="margin-top:12px">Belum ada agenda pada hari ini.<br><br><button class="btn pri" id="addFirst">' + ic("plus") + "Tambah agenda</button></div>";
    else html += '<div class="route">' + list.map(function (s, i) {
      var cls = i === nowIdx ? " now" : (S.day < today || (S.day === today && i < nowIdx) ? " past" : "");
      var prev = list[i - 1], leg = "";
      if (prev && prev.place && s.place && prev.place !== s.place) leg = '<div class="stop"><span></span><span class="rail"></span><div class="leg"><a href="' + esc(dirUrl(prev.place, s.place)) + '" target="_blank" rel="noopener">' + ic("nav") + "Petunjuk arah</a></div></div>";
      var mu = mapsUrl(s);
      return leg + '<div class="stop' + cls + '"><div class="tm">' + esc(hhmm(s.start_t) || "–") + (s.end_t ? "<small>" + esc(hhmm(s.end_t)) + "</small>" : "") + '</div><div class="rail"><span class="dot"></span></div><div class="card" role="button" tabindex="0" data-s="' + s.id + '"><div class="t">' + esc(s.title) + (i === nowIdx ? '<span class="now-tag">SEKARANG</span>' : "") + "</div>" +
        (s.place ? '<a class="pl" href="' + esc(mu) + '" target="_blank" rel="noopener">' + ic("pin") + esc(s.place) + "</a>" : "") + (s.note ? '<div class="nt">' + esc(s.note) + "</div>" : "") + "</div></div>";
    }).join("") + "</div>";
    html += '<p class="hint" style="margin-top:16px">Semua jam memakai ' + esc(t.tz || "WIB") + '. Ketuk agenda untuk mengubahnya. Tombol "Petunjuk arah" membuka rute dan perkiraan waktu tempuh di Google Maps.</p>';
    shell(t, "rundown", html, "Agenda");
    document.getElementById("fab").onclick = function () { stopSheet(null); };
    var af = document.getElementById("addFirst"); if (af) af.onclick = function () { stopSheet(null); };
    $app.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { S.day = b.dataset.d; renderRundown(t); }; });
    $app.querySelectorAll("[data-s]").forEach(function (b) {
      var open = function (ev) { if (ev.target.closest("a")) return; stopSheet(t.stops.find(function (s) { return s.id === b.dataset.s; })); };
      b.onclick = open; b.onkeydown = function (ev) { if (ev.key === "Enter") open(ev); };
    });
    var on = $app.querySelector(".stop.now"); if (on) on.scrollIntoView({ block: "center" });
  }
  function stopSheet(s) {
    var t = S.trip, isNew = !s;
    s = s || { day: S.day, start_t: "", end_t: "", title: "", place: "", maps_url: "", note: "" };
    var c = openSheet("<h2>" + (isNew ? "Tambah agenda" : "Ubah agenda") + '</h2><form id="sf">' +
      '<div class="f"><label for="st">Nama kegiatan</label><input class="in-t" id="st" required placeholder="Contoh: Registrasi peserta"></div>' +
      '<div class="f"><label for="sd">Hari</label><select class="in-t" id="sd">' + tripDays(t).concat(tripDays(t).indexOf(s.day) < 0 ? [s.day] : []).map(function (d) { return '<option value="' + d + '"' + (d === s.day ? " selected" : "") + ">" + esc(fmtDay(d, { weekday: "long", day: "numeric", month: "long" })) + "</option>"; }).join("") + "</select></div>" +
      '<div class="two"><div class="f"><label for="s1">Jam mulai</label><input class="in-t mono" id="s1" type="time"></div><div class="f"><label for="s2">Jam selesai</label><input class="in-t mono" id="s2" type="time"></div></div>' +
      '<div class="f"><label for="sp">Lokasi</label><input class="in-t" id="sp" placeholder="Nama tempat dan kota"><span class="hint">Lokasi dipakai untuk tautan peta dan petunjuk arah.</span></div>' +
      '<details class="more"' + (s.maps_url || s.note ? " open" : "") + '><summary>Tautan peta dan catatan</summary>' +
      '<div class="f"><label for="su">Tautan Google Maps</label><input class="in-t" id="su" type="url" placeholder="https://maps.app.goo.gl/…"></div>' +
      '<div class="f"><label for="sn">Catatan</label><textarea class="in-t" id="sn"></textarea></div></details>' +
      '<div class="save-bar"><button class="btn pri block" type="submit">Simpan agenda</button></div>' + (isNew ? "" : '<button type="button" class="btn danger block" id="sdel" style="margin-top:10px">Hapus agenda</button>') + "</form>");
    c.querySelector("#st").value = s.title; c.querySelector("#s1").value = s.start_t; c.querySelector("#s2").value = s.end_t;
    c.querySelector("#sp").value = s.place; c.querySelector("#su").value = s.maps_url; c.querySelector("#sn").value = s.note;
    c.querySelector("#sf").onsubmit = async function (ev) {
      ev.preventDefault(); ev.target.querySelector("button[type=submit]").disabled = true;
      var body = { title: c.querySelector("#st").value.trim(), day: c.querySelector("#sd").value, start_t: c.querySelector("#s1").value, end_t: c.querySelector("#s2").value, place: c.querySelector("#sp").value.trim(), maps_url: c.querySelector("#su").value.trim(), note: c.querySelector("#sn").value };
      if (isNew) { body.trip_id = t.id; body.sort = t.stops.length; t.stops.push((await api("/api/items?t=stops", { method: "POST", body: body })).item); }
      else Object.assign(s, (await api("/api/items?t=stops&id=" + s.id, { method: "PATCH", body: body })).item);
      S.day = body.day; closeSheet(); renderRundown(t); toast("Agenda tersimpan");
    };
    if (!isNew) c.querySelector("#sdel").onclick = async function () {
      if (!confirm('Hapus agenda "' + s.title + '"?')) return;
      await api("/api/items?t=stops&id=" + s.id, { method: "DELETE" });
      t.stops = t.stops.filter(function (x) { return x.id !== s.id; }); closeSheet(); renderRundown(t);
    };
  }

  /* ---------- DIARI ---------- */
  function renderDiari(t) {
    var days = tripDays(t), today = nowIn(t).slice(0, 10), by = {};
    t.moments.forEach(function (m) { (by[m.day] = by[m.day] || []).push(m); });
    var months = [];
    days.concat(Object.keys(by)).forEach(function (d) { var m = d.slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
    months.sort();
    var html = '<p class="muted" style="margin:0 0 14px;font-size:14px;line-height:1.55">Diari menyimpan foto kegiatan per hari. Ketuk tanggal untuk menambah foto; ceritanya boleh ditulis belakangan.</p>';
    html += months.map(function (m) {
      var first = dObj(m + "-01"), dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), pad = (first.getUTCDay() + 6) % 7;
      var cells = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map(function (w) { return '<div class="wd">' + w + "</div>"; }).join("");
      for (var i = 0; i < pad; i++) cells += '<div class="cell blank"></div>';
      for (var d = 1; d <= dim; d++) {
        var ds = m + "-" + (d < 10 ? "0" : "") + d, ph = by[ds] || [];
        cells += '<button class="cell' + (ph.length ? " has" : "") + (days.indexOf(ds) >= 0 ? " trip" : "") + (ds === today ? " today" : "") + '" data-day="' + ds + '" aria-label="' + esc(fmtDay(ds, { day: "numeric", month: "long" })) + (ph.length ? ", " + ph.length + " foto" : "") + '">' + (ph.length ? '<img src="' + esc(ph[0].url) + '" alt="" loading="lazy"><em>' + ph.length + "</em>" : "") + "<span>" + d + "</span></button>";
      }
      return '<div class="cal" style="margin-bottom:14px"><h3>' + esc(first.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })) + '</h3><div class="cal-g">' + cells + '</div><div class="legend" style="margin-top:10px"><span><i class="tripd"></i>Hari perjalanan</span></div></div>';
    }).join("");
    html += '<div class="sec">Hari perjalanan</div><div class="list">' + days.map(function (d) {
      var n = (by[d] || []).length, note = (t.day_notes || {})[d];
      return '<button class="row" data-day="' + d + '"><span class="ic">' + ic("img") + '</span><span class="mid"><span class="t">' + esc(fmtDay(d, { weekday: "long", day: "numeric", month: "long" })) + '</span><span class="s">' + (n ? n + " foto" : "Belum ada foto") + (note ? " · ada cerita" : "") + "</span></span></button>";
    }).join("") + "</div>";
    shell(t, "diari", html, "");
    $app.querySelectorAll("[data-day]").forEach(function (b) { b.onclick = function () { location.hash = "#/t/" + t.id + "/diari/" + b.dataset.day; }; });
  }
  function renderDay(t, day) {
    var ms = t.moments.filter(function (m) { return m.day === day; });
    var runs = t.stops.filter(function (s) { return s.day === day; }).sort(function (a, b) { return (a.start_t || "99").localeCompare(b.start_t || "99"); });
    var html = '<a class="link-back" href="#/t/' + t.id + '/diari">' + ic("back", ' width="16" height="16"') + 'Kembali ke kalender</a><div class="day-head">' + esc(fmtDay(day, { weekday: "long", day: "numeric", month: "long" })) + '</div><p class="muted mono" style="margin:0 0 16px;font-size:12px">' + ms.length + " foto</p>" +
      '<div class="btns" style="margin-bottom:16px"><button class="btn pri" id="dc">' + ic("cam") + 'Ambil foto</button><button class="btn" id="dg">' + ic("img") + "Pilih dari galeri</button></div>" +
      (ms.length ? '<div class="photos" id="pl">' + ms.map(function (m) { return '<button class="ph" data-m="' + m.id + '"><img src="' + esc(m.url) + '" alt="" loading="lazy"><p class="' + (m.caption ? "" : "later") + '">' + (m.caption ? esc(m.caption) : "Belum ada catatan. Ketuk untuk menulis.") + "</p></button>"; }).join("") + "</div>" : '<div class="empty">Belum ada foto pada hari ini. Foto kegiatan, teman satu tim, atau tempat yang dikunjungi.</div>') +
      '<div class="sec">Cerita hari ini</div><textarea class="in-t" id="dn" placeholder="Apa saja yang terjadi hari ini? Boleh diisi nanti.">' + esc((t.day_notes || {})[day] || "") + "</textarea><p class=\"hint\" id=\"dns\">Cerita tersimpan otomatis.</p>" +
      (runs.length ? '<div class="sec">Agenda hari ini</div><div class="mini-run">' + runs.map(function (s) { return "<div><b>" + esc(hhmm(s.start_t) || "–") + "</b>" + esc(s.title) + "</div>"; }).join("") + "</div>" : "");
    shell(t, "diari", html, "");
    var up = async function (files, cam) {
      if (!files.length) return;
      toast("Mengunggah " + files.length + " foto…", 60000);
      for (var i = 0; i < files.length; i++) {
        try {
          var r = await uploadFile(files[i], "diari");
          var j = await api("/api/items?t=moments", { method: "POST", body: { trip_id: t.id, day: day, url: r.url, caption: "" } });
          t.moments.push(j.item);
        } catch (x) { toast("Satu foto gagal diunggah"); }
      }
      renderDay(t, day);
      if (cam) { var last = t.moments[t.moments.length - 1]; if (last) momentSheet(last, true); }
      else toast("Foto berhasil ditambahkan");
    };
    document.getElementById("dc").onclick = async function () { up(await pickFiles({ camera: true }), true); };
    document.getElementById("dg").onclick = async function () { up(await pickFiles({ multiple: true }), false); };
    $app.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { momentSheet(t.moments.find(function (m) { return m.id === b.dataset.m; })); }; });
    var dn = document.getElementById("dn"), timer;
    var saveNote = async function () {
      t.day_notes = Object.assign({}, t.day_notes); t.day_notes[day] = dn.value;
      try { await api("/api/trips?id=" + t.id, { method: "PATCH", body: { day_notes: t.day_notes } }); document.getElementById("dns").textContent = "Cerita tersimpan."; }
      catch (x) { document.getElementById("dns").textContent = "Cerita belum tersimpan. Periksa sinyal."; }
    };
    dn.oninput = function () { document.getElementById("dns").textContent = "Menyimpan…"; clearTimeout(timer); timer = setTimeout(saveNote, 900); };
  }
  function momentSheet(m, justShot) {
    var t = S.trip;
    var c = openSheet('<div class="viewer"><img src="' + esc(m.url) + '" alt=""></div>' +
      (justShot ? '<p class="hint" style="margin:10px 0 0">Foto dari kamera browser tidak otomatis masuk galeri HP. Ketuk "Simpan ke galeri" jika ingin menyimpan cadangan.</p>' : "") +
      '<div class="f" style="margin-top:14px"><label for="mc">Catatan foto</label><textarea class="in-t" id="mc" placeholder="Siapa, di mana, sedang apa">' + esc(m.caption) + "</textarea></div>" +
      '<div class="btns"><button class="btn pri" id="ms">Simpan catatan</button><button class="btn" id="mg">' + ic("dl") + 'Simpan ke galeri</button></div><button class="btn danger block" id="md" style="margin-top:10px">Hapus foto</button>');
    c.querySelector("#ms").onclick = async function () {
      var j = await api("/api/items?t=moments&id=" + m.id, { method: "PATCH", body: { caption: c.querySelector("#mc").value } });
      Object.assign(m, j.item); closeSheet(); renderDay(t, m.day); toast("Catatan tersimpan");
    };
    c.querySelector("#mg").onclick = function () { saveToGallery(m.url); };
    c.querySelector("#md").onclick = async function () {
      if (!confirm("Hapus foto ini dari diari?")) return;
      await api("/api/items?t=moments&id=" + m.id, { method: "DELETE" });
      api("/api/upload?url=" + encodeURIComponent(m.url), { method: "DELETE" }).catch(function () {});
      t.moments = t.moments.filter(function (x) { return x.id !== m.id; }); closeSheet(); renderDay(t, m.day);
    };
  }

  /* ---------- LAPORAN ---------- */
  function csv(t) {
    var rows = [["No", "Tanggal", "Jenis", "Kategori", "Keterangan", "Status", "Nominal", "Jumlah bukti", "Tautan bukti", "Catatan"]];
    t.entries.forEach(function (e, i) { rows.push([i + 1, e.date || "", e.kind === "in" ? "Masuk" : "Keluar", e.category, e.title, e.kind === "in" ? "Diterima" : (e.status === "plan" ? "Rencana" : "Dibayar"), e.amount, (e.proofs || []).length, (e.proofs || []).map(function (p) { return p.url; }).join(" "), e.note || ""]); });
    var tot = totals(t);
    rows.push([]); rows.push(["", "", "", "", "Total dana masuk", "", tot.in]); rows.push(["", "", "", "", "Total sudah dibayar", "", tot.paid]); rows.push(["", "", "", "", "Sisa dana", "", tot.left]);
    return "﻿" + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
  }
  function renderLapor(t) {
    var tot = totals(t), paidOut = t.entries.filter(function (e) { return e.kind === "out" && e.status === "paid"; });
    var proofs = t.entries.reduce(function (a, e) { return a + (e.proofs || []).length; }, 0);
    var html = '<div class="sec" style="margin-top:4px">Laporan pertanggungjawaban</div><p class="muted" style="font-size:14px;line-height:1.55;margin:0 0 14px">Laporan berisi rekap transaksi dan semua foto bukti sebagai lampiran. Buka laporan, lalu pilih <b>Simpan sebagai PDF</b> pada menu cetak. Format CSV dapat dibuka di Excel.</p>' +
      '<div class="cats"><div class="cat-row"><span>Dana masuk</span><span></span><b class="mono">' + rp(tot.in) + '</b></div><div class="cat-row"><span>Sudah dibayar</span><span></span><b class="mono">' + rp(tot.paid) + '</b></div><div class="cat-row"><span>Sisa dana</span><span></span><b class="mono">' + rp(tot.left) + '</b></div><div class="cat-row"><span>Foto bukti</span><span></span><b class="mono">' + proofs + "</b></div></div>" +
      '<div class="btns" style="margin-top:14px"><a class="btn pri" href="#/lapor/' + t.id + '">' + ic("doc") + 'Buka laporan PDF</a><button class="btn" id="csv">' + ic("dl") + "Unduh CSV</button></div>";
    if (tot.noProof.length) html += '<div class="sec">Belum ada foto bukti<span class="act mono">' + tot.noProof.length + "</span></div><p class=\"hint\" style=\"margin:-4px 0 10px\">Ketuk transaksi untuk melampirkan foto.</p><div class=\"list\">" + tot.noProof.map(entryRow).join("") + "</div>";
    else if (paidOut.length) html += '<div class="note-card" style="margin-top:16px">Semua pengeluaran yang sudah dibayar memiliki foto bukti. Laporan siap diserahkan.</div>';
    var unconf = t.entries.filter(function (e) { return e.flag; });
    if (unconf.length) html += '<div class="sec">Perlu dicek</div><div class="list">' + unconf.map(entryRow).join("") + "</div>";
    shell(t, "lapor", html, "");
    document.getElementById("csv").onclick = function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(t)], { type: "text/csv;charset=utf-8" }));
      a.download = "Laporan " + t.title.replace(/[^\w\s-]/g, "") + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    };
    $app.querySelectorAll("[data-e]").forEach(function (b) { b.onclick = function () { entrySheet(t.entries.find(function (e) { return e.id === b.dataset.e; })); }; });
  }
  function renderReport(t) {
    var tot = totals(t), ins = t.entries.filter(function (e) { return e.kind === "in"; }), paid = t.entries.filter(function (e) { return e.kind === "out" && e.status === "paid"; }), plan = t.entries.filter(function (e) { return e.kind === "out" && e.status === "plan"; });
    var n = 0, att = [];
    function rows(list) { return list.map(function (e) {
      var refs = (e.proofs || []).map(function (p) { att.push({ e: e, p: p }); return "L" + att.length; }).join(", ");
      return "<tr><td>" + (++n) + "</td><td>" + esc(e.date ? fmtDay(e.date, { day: "numeric", month: "short", year: "numeric" }) : "-") + "</td><td>" + esc(e.title) + (e.note ? '<br><span style="color:#666">' + esc(e.note) + "</span>" : "") + "</td><td>" + esc(e.category) + '</td><td class="n">' + rp(e.amount) + "</td><td>" + (refs || (e.kind === "in" ? "-" : '<span style="color:#b00">belum ada</span>')) + "</td></tr>";
    }).join(""); }
    var head = "<tr><th>No.</th><th>Tanggal</th><th>Uraian</th><th>Kategori</th><th>Nominal</th><th>Bukti</th></tr>";
    var body = '<h1>Laporan Penggunaan Dana</h1><div class="meta"><b>' + esc(t.title) + "</b><br>" + esc(fmtDay(t.start_date, { day: "numeric", month: "long", year: "numeric" })) + " s.d. " + esc(fmtDay(t.end_date, { day: "numeric", month: "long", year: "numeric" })) + (t.place ? " · " + esc(t.place) : "") + "<br>Disusun oleh: " + esc((S.me && S.me.name) || "") + "</div>" +
      '<div class="sum"><div>Dana diterima<b>' + rp(tot.in) + "</b></div><div>Total pengeluaran<b>" + rp(tot.paid) + "</b></div><div>Sisa dana<b>" + rp(tot.left) + "</b></div></div>" +
      '<h2>A. Dana diterima</h2><div class="tw"><table>' + head + rows(ins) + '<tr><td colspan="4"><b>Jumlah</b></td><td class="n"><b>' + rp(tot.in) + "</b></td><td></td></tr></table></div>" +
      '<h2>B. Pengeluaran</h2><div class="tw"><table>' + head + rows(paid) + '<tr><td colspan="4"><b>Jumlah</b></td><td class="n"><b>' + rp(tot.paid) + "</b></td><td></td></tr></table></div>" +
      (plan.length ? '<h2>C. Rencana yang belum dibayar</h2><div class="tw"><table>' + head + rows(plan) + '<tr><td colspan="4"><b>Jumlah</b></td><td class="n"><b>' + rp(tot.plan) + "</b></td><td></td></tr></table></div>" : "") +
      '<div class="sign"><div>' + esc(fmtDay(todayWIB(), { day: "numeric", month: "long", year: "numeric" })) + "<br><br><br><br>( " + esc((S.me && S.me.name) || "....................") + " )</div></div>" +
      (att.length ? '<h2 style="break-before:page;page-break-before:always">Lampiran bukti</h2>' + att.map(function (a, i) { return '<div class="att"><p><b>L' + (i + 1) + "</b> · " + esc(a.e.title) + " · " + rp(a.e.amount) + (a.e.date ? " · " + esc(fmtDay(a.e.date, { day: "numeric", month: "short", year: "numeric" })) : "") + '</p><img src="' + esc(a.p.url) + '" alt="Lampiran L' + (i + 1) + '"></div>'; }).join("") : "");
    $app.innerHTML = '<div class="report"><div class="r-bar"><a class="link-back" style="color:#fff;margin:0" href="#/t/' + t.id + '/lapor">' + ic("back", ' width="18" height="18"') + 'Kembali</a><span class="sp"></span><button class="btn pri sm" id="pr">' + ic("print") + 'Cetak atau simpan PDF</button></div><div class="doc">' + body + "</div></div>";
    document.getElementById("pr").onclick = function () { window.print(); };
    document.title = "Laporan " + t.title;
  }

  /* ---------- router ---------- */
  async function route() {
    if (!S.me) return renderAuth();
    closeSheet();
    document.title = BRAND;
    var h = location.hash.replace(/^#\/?/, "").split("/");
    try {
      if (h[0] === "t" && h[1]) {
        if (!S.trip || S.trip.id !== h[1]) { $app.innerHTML = '<div class="boot">Memuat…</div>'; await loadTrip(h[1]); }
        var t = S.trip, tab = h[2] || "dana";
        if (tab === "rundown") renderRundown(t);
        else if (tab === "diari" && h[3]) renderDay(t, h[3]);
        else if (tab === "diari") renderDiari(t);
        else if (tab === "lapor") renderLapor(t);
        else renderDana(t);
        if (!h[3]) window.scrollTo(0, 0);
        return;
      }
      if (h[0] === "lapor" && h[1]) { if (!S.trip || S.trip.id !== h[1]) await loadTrip(h[1]); renderReport(S.trip); window.scrollTo(0, 0); return; }
      S.trip = null; await renderHome();
    } catch (e) {
      if (e.message === "unauthorized") return;
      $app.innerHTML = '<div class="wrap"><div class="empty">' + (e.status === 404 ? "Perjalanan tidak ditemukan." : "Data belum bisa dimuat. Periksa sinyal, lalu coba lagi.") + '<br><br><a class="btn" href="#/">Kembali</a> <button class="btn" onclick="location.reload()">Muat ulang</button></div></div>';
    }
  }
  window.addEventListener("hashchange", route);

  async function boot() {
    try { S.me = await api("/api/auth"); } catch (e) { S.me = null; }
    if (!S.me) { renderAuth(/daftar|signup/.test(location.search) ? "signup" : "login"); return; }
    try { S.ai = !!(await api("/api/ai")).enabled; } catch (e) {}
    if (!location.hash || location.hash === "#/") {
      try { var j = await api("/api/trips"); var today = todayWIB(); var cur = j.trips.find(function (t) { return t.start_date <= today && t.end_date >= today; }) || (j.trips.length === 1 ? j.trips[0] : null); if (cur) history.replaceState(null, "", "#/t/" + cur.id + "/dana"); } catch (e) {}
    }
    route();
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
  boot();
})();
