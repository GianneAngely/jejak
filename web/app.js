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
  function fmtDay(d, opt) { return dObj(d).toLocaleDateString(LOC(), Object.assign({ timeZone: "UTC" }, opt || { weekday: "short", day: "numeric", month: "short" })); }
  function addDays(d, n) { var x = dObj(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function tripDays(t) { var out = [], d = t.start_date; while (d <= t.end_date && out.length < 60) { out.push(d); d = addDays(d, 1); } return out; }
  function hhmm(s) { return s ? s.replace(":", ".") : ""; }

  /* ---------- bahasa: "id" (asli) dan "en". Teks Indonesia sekaligus kunci kamus EN.
     Urutan: ?lang= (ikut disimpan), localStorage "jejak.lang", lalu bahasa browser. ---------- */
  var LK = "jejak.lang";
  var LANG = (function () {
    var q = (location.search.match(/[?&]lang=(id|en)\b/) || [])[1], s;
    if (q) { try { localStorage.setItem(LK, q); } catch (e) {} return q; }
    try { s = localStorage.getItem(LK); } catch (e) {}
    if (s === "id" || s === "en") return s;
    return /^id\b/i.test(navigator.language || "") ? "id" : "en";
  })();
  document.documentElement.lang = LANG;
  function LOC() { return LANG === "en" ? "en-GB" : "id-ID"; }
  /* T("teks", {n: 2}): terjemahan (kalau ada) lalu isi {n}. Nilai EN berupa [satu, banyak] dipilih dari v.n.
     Akhiran "§konteks" membedakan kata yang sama dengan arti berbeda; teks Indonesianya tanpa akhiran. */
  function T(s, v) {
    var i = s.indexOf("§"), o = LANG === "en" && Object.prototype.hasOwnProperty.call(EN, s) ? EN[s] : (i < 0 ? s : s.slice(0, i));
    if (Array.isArray(o)) o = o[v && v.n === 1 ? 0 : 1];
    return v ? o.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m; }) : o;
  }
  /* kategori tersimpan dalam bahasa Indonesia; hanya tampilannya yang diterjemahkan */
  var CAT_EN = { Penginapan: "Lodging", Makan: "Meals", Cetak: "Printing", "Lain-lain": "Other", "Dana kampus": "Campus grant", Pribadi: "Personal" };
  function catName(k) { return LANG === "en" && CAT_EN[k] ? CAT_EN[k] : k; }
  function langToggle() { return '<span class="lang-t" role="group" aria-label="' + T("Bahasa") + '">' + ["id", "en"].map(function (l) { return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === LANG) + '"' + (l === LANG ? ' class="on"' : "") + ">" + l.toUpperCase() + "</button>"; }).join('<span aria-hidden="true">·</span>') + "</span>"; }
  function bindLang(root) { root.querySelectorAll("[data-lang]").forEach(function (b) { b.onclick = function () { setLang(b.dataset.lang); }; }); }
  function setLang(l) {
    if (l === LANG) return;
    LANG = l; document.documentElement.lang = l;
    try { localStorage.setItem(LK, l); } catch (e) {}
    closeSheet();
    if (S.me) route(); else renderAuth(S.authMode);
  }
  var EN = {
    /* umum */
    "Bahasa": "Language", "Memuat…": "Loading…", "Simpan": "Save", "Kembali": "Back", "Muat ulang": "Reload",
    "terpakai": "used", "Warna pudar pada cincin menandai rencana yang belum dibayar.": "Faded segments are planned costs that are not paid yet.",
    "Gambar tidak bisa dibaca": "This image can't be read", "Foto sudah diunduh. Periksa folder Download atau galeri.": "Photo downloaded. Check your Downloads folder or gallery.",
    "Foto gagal disimpan.": "Couldn't save the photo.",
    /* masuk / daftar */
    "Catat dana perjalanan, simpan foto struk, dan susun jadwal di satu tempat. Laporan pertanggungjawaban siap dicetak sepulang dinas atau lomba.": "Track travel funds, keep receipt photos, and plan your schedule in one place. Your expense report is ready to print when you get back.",
    "Masuk": "Log in", "Daftar": "Sign up", "Nama": "Name", "Nama yang tercantum di laporan": "Name to show on the report", "Email": "Email", "Kata sandi": "Password",
    "Minimal 8 karakter.": "At least 8 characters.", "Kode undangan": "Invite code", "Boleh dikosongkan": "Optional",
    "Masukkan kode undangan atau kode ajakan dari rekan setim agar perjalanannya langsung muncul.": "Enter an invite code or a teammate's join code so their trip shows up right away.",
    "Punya kode undangan atau kode ajakan?": "Have an invite or join code?", "Buat akun": "Create account",
    "Sudah punya akun? <button type=\"button\" class=\"link-btn\" data-m=\"login\">Masuk di sini</button>": "Already have an account? <button type=\"button\" class=\"link-btn\" data-m=\"login\">Log in</button>",
    "Belum punya akun? <button type=\"button\" class=\"link-btn\" data-m=\"signup\">Daftar gratis</button>": "New here? <button type=\"button\" class=\"link-btn\" data-m=\"signup\">Sign up free</button>",
    "Email atau kata sandi salah.": "Wrong email or password.", "Email ini sudah terdaftar. Silakan masuk.": "This email is already registered. Please log in.",
    "Kata sandi minimal 8 karakter.": "Password must be at least 8 characters.", "Format email belum benar.": "That email address doesn't look right.",
    "Kode undangan tidak dikenal atau sudah dipakai.": "Unknown invite code, or it has already been used.", "Koneksi gagal. Periksa sinyal, lalu coba lagi.": "Connection failed. Check your signal and try again.",
    /* karcis + beranda */
    "{n} hari": ["{n} day", "{n} days"], "Sisa dana": "Funds left", "Dana masuk {a} · terpakai {b}": "Received {a} · spent {b}",
    "Setelah semua rencana dibayar:": "After all planned costs:", "Akun": "Account",
    "Selamat datang": "Welcome", "Mulai dalam tiga langkah berikut.": "Get started in three steps.",
    "Buat perjalanan": "Create a trip", "Nama acara, kota, dan tanggal.": "Event name, city, and dates.",
    "Catat dana masuk": "Record incoming funds", "Dana dari kampus, kantor, atau sponsor.": "Money from your campus, office, or sponsor.",
    "Foto struk setiap membayar": "Snap a receipt every time you pay", "Bukti langsung tersimpan untuk laporan.": "Proof is saved for the report right away.",
    "Punya kode undangan? Buka menu <b>Akun</b> di kanan atas.": "Have an invite code? Open <b>Account</b> at the top right.",
    "Perjalanan saya": "My trips", "Dibagikan oleh {n}": "Shared by {n}", "pemilik": "the owner", "Buat perjalanan baru": "New trip",
    /* akun */
    "Kode undangan atau kode ajakan": "Invite or join code", "Masukkan kode": "Enter code", "Pakai kode": "Use code",
    "Kode ajakan dari rekan setim membuat perjalanan mereka muncul di berandamu.": "A join code from a teammate adds their trip to your home screen.",
    "Buka halaman depan": "Open the home page", "Keluar dari akun": "Log out",
    "Kamu sudah bergabung ke perjalanan": "You've joined the trip", "Kode berhasil dipakai. Datanya sudah masuk ke akunmu.": "Code applied. The data is now in your account.",
    "Kode tidak dikenal atau sudah dipakai.": "Unknown code, or it has already been used.",
    /* form perjalanan */
    "Ubah perjalanan": "Edit trip", "Perjalanan baru": "New trip", "Nama perjalanan": "Trip name", "Contoh: Final lomba desain di Bandung": "e.g. Design competition final in Bandung",
    "Kota atau tempat": "City or venue", "Contoh: Institut Teknologi Bandung": "e.g. Bandung Institute of Technology", "Tanggal mulai": "Start date", "Tanggal selesai": "End date",
    "Zona waktu di tujuan": "Time zone at destination", "Simpan perubahan": "Save changes", "Hapus perjalanan": "Delete trip",
    "Tanggal selesai tidak boleh sebelum tanggal mulai.": "The end date can't be before the start date.", "Perubahan tersimpan": "Changes saved",
    "Hapus \"{t}\" beserta semua transaksi, jadwal, dan diari? Tindakan ini tidak bisa dibatalkan.": "Delete \"{t}\" with all its transactions, schedule, and diary? This can't be undone.",
    /* berbagi */
    "dicatat oleh kamu": "added by you", "dicatat oleh {n}": "added by {n}", "anggota lain": "another member", " (kamu)": " (you)", "Pemilik": "Owner", "Anggota": "Member", "Keluarkan": "Remove",
    "Anggota perjalanan": "Trip members", "Ajak anggota": "Invite members",
    "Kirim kode ini ke rekan setim. Mereka membuka <b>Akun</b>, lalu memasukkan kode pada kolom <b>Kode undangan atau kode ajakan</b>. Anggota bisa melihat, menambah, dan mengubah isi perjalanan ini.": "Send this code to your teammates. They open <b>Account</b> and enter it under <b>Invite or join code</b>. Members can view, add, and edit everything in this trip.",
    "Bagikan kode": "Share code", "Buat kode baru": "New code", "Cabut kode": "Revoke code",
    "Buat kode ajakan agar rekan setim bisa masuk dengan akunnya sendiri dan mengisi perjalanan ini bersama.": "Create a join code so teammates can use their own accounts and fill in this trip with you.",
    "Buat kode ajakan": "Create join code", "Buat kode baru? Kode lama tidak bisa dipakai lagi.": "Create a new code? The old one will stop working.",
    "Kode ajakan siap dibagikan": "Join code ready to share", "Cabut kode ajakan? Anggota yang sudah bergabung tetap menjadi anggota.": "Revoke the join code? People who already joined stay members.",
    "Kode ajakan dicabut": "Join code revoked",
    "Ayo isi catatan perjalanan \"{t}\" bersama di {b}. Buka {u}/app, masuk atau daftar, lalu buka Akun dan masukkan kode ajakan: {c}": "Let's track the \"{t}\" trip together on {b}. Go to {u}/app, log in or sign up, then open Account and enter the join code: {c}",
    "Pesan ajakan tersalin": "Invite message copied", "Salin kode secara manual": "Copy the code manually",
    "Keluarkan anggota ini dari perjalanan?": "Remove this member from the trip?", "Anggota dikeluarkan": "Member removed",
    "Kamu bisa melihat, menambah, dan mengubah isi perjalanan ini. Judul, tanggal, kode ajakan, dan daftar anggota diatur oleh pemilik.": "You can view, add, and edit everything in this trip. The title, dates, join code, and member list are managed by the owner.",
    "Keluar dari perjalanan ini": "Leave this trip", "Keluar dari perjalanan ini? Kamu perlu kode ajakan baru untuk bergabung lagi.": "Leave this trip? You'll need a new join code to come back.",
    "Kamu sudah keluar dari perjalanan": "You left the trip",
    /* kerangka */
    "Dana": "Funds", "Jadwal": "Schedule", "Diari": "Diary", "Catatan": "Notes", "Laporan": "Report", "Catatan§f": "Note", "Catatan§fab": "Note",
    "Semua perjalanan": "All trips", "Ubah": "Edit", "Menu perjalanan": "Trip menu",
    /* dana */
    "{n} foto bukti": ["{n} receipt photo", "{n} receipt photos"], "Belum ada foto bukti": "No receipt photo yet", "Diterima": "Received", "Rencana": "Planned", "Lunas": "Paid",
    "Catat": "Add", "Catat pengeluaran pertama": "Record your first expense", "Tiket, penginapan, makan, atau cetak.": "Tickets, lodging, meals, or printing.",
    "Lampirkan foto bukti": "Attach a receipt photo", "Foto struk, nota, atau tiket.": "A photo of a receipt, invoice, or ticket.", "Foto struk": "Snap receipt",
    "Langkah awal": "Getting started", "Catat manual": "Add manually",
    "<b>{n} pengeluaran belum punya foto bukti.</b> Ketuk untuk melihat daftarnya.": ["<b>{n} expense has no receipt photo yet.</b> Tap to see it.", "<b>{n} expenses have no receipt photo yet.</b> Tap to see the list."],
    "Jatah makan hari ini": "Meal budget today", "Jatah makan per hari": "Meal budget per day",
    "tersisa dari {a} · terpakai {b}": "left of {a} · spent {b}", "untuk {n} hari perjalanan, setelah rencana lain dibayar": ["for {n} trip day, after other planned costs", "for {n} trip days, after other planned costs"],
    "Minta saran anggaran": "Get budget advice", "Pemakaian dana": "Spending by category", "Sudah dibayar": "Paid",
    "Belum ada pengeluaran yang dibayar. Ketuk <b>Foto struk</b> setiap kali membayar.": "No paid expenses yet. Tap <b>Snap receipt</b> every time you pay.",
    "Rencana, belum dibayar": "Planned, not paid yet", "Dana masuk": "Incoming funds",
    "Catat dana dari kampus, kantor, atau sponsor agar sisa dana terhitung.": "Record money from your campus, office, or sponsor so the balance adds up.",
    "Sedang menghitung…": "Working it out…", "Saran belum tersedia. Coba lagi sebentar.": "No advice yet. Try again in a moment.",
    "Saran belum bisa dibuat sekarang.": "Advice isn't available right now.", "Minta saran lagi": "Ask again",
    /* form transaksi */
    "Catat pengeluaran": "Add expense", "Ubah transaksi": "Edit transaction", "Pengeluaran": "Expense", "Nominal": "Amount", "Keterangan": "Description",
    "Foto bukti": "Receipt photo", "Ambil foto": "Take photo", "Pilih dari galeri": "Choose from gallery", "Baca struk": "Read receipt",
    "Status pembayaran": "Payment status", "Belum, masih rencana": "Not yet, planned", "Kategori": "Category", "Tanggal dan catatan": "Date and note",
    "Tanggal": "Date", "Tanda perlu dicek": "Needs-checking flag", "Kosongkan jika sudah beres.": "Clear it once it's sorted.", "Hapus transaksi": "Delete transaction",
    "Transaksi ini {by}.": "This transaction was {by}.", "Contoh: Dana lomba dari kampus": "e.g. Competition grant from campus", "Contoh: Ojek daring ke hotel": "e.g. Ride to the hotel",
    "Foto bukti (opsional)": "Receipt photo (optional)", "Foto bukti {n}": "Receipt photo {n}", "Hapus foto bukti": "Remove receipt photo", "Simpan ke galeri": "Save to gallery", "Unduh": "Download",
    "Hapus foto bukti ini?": "Remove this receipt photo?", "Mengunggah foto…": "Uploading photo…",
    "Foto dari kamera tidak otomatis masuk galeri HP. Ketuk \"Simpan ke galeri\" untuk menyimpan cadangan.": "Camera photos aren't saved to your phone's gallery automatically. Tap \"Save to gallery\" to keep a copy.",
    "Struk berhasil dibaca. Periksa kembali nominalnya.": "Receipt read. Double-check the amount.", "Struk tidak terbaca. Isi nominal secara manual.": "Couldn't read the receipt. Enter the amount yourself.",
    "Foto gagal diunggah. Coba lagi.": "Photo upload failed. Try again.", "Tunggu sampai foto selesai diunggah.": "Wait until the photo finishes uploading.",
    "Nominal belum diisi.": "Enter an amount.", "Keterangan belum diisi.": "Add a description.", "Transaksi tercatat": "Transaction saved",
    "Gagal menyimpan. Periksa sinyal, lalu coba lagi.": "Couldn't save. Check your signal and try again.",
    "Hapus \"{t}\"? Foto buktinya ikut terhapus.": "Delete \"{t}\"? Its receipt photos will be deleted too.", "Transaksi terhapus": "Transaction deleted",
    /* jadwal */
    "Petunjuk arah": "Directions", "Jadwal perjalanan": "Trip schedule", "Agenda per jam, lengkap dengan lokasi dan petunjuk arah.": "Hour-by-hour agenda with places and directions.",
    "Belum ada agenda pada hari ini.": "Nothing scheduled for this day yet.", "Tambah agenda": "Add agenda item", "SEKARANG": "NOW",
    "Jam memakai {tz}, kecuali disebutkan lain pada agenda. Ketuk agenda untuk mengubahnya. Tombol \"Petunjuk arah\" membuka rute dan perkiraan waktu tempuh di Google Maps.": "Times are in {tz} unless an item says otherwise. Tap an item to edit it. \"Directions\" opens the route and travel time in Google Maps.",
    "Agenda": "Agenda item", "Ubah agenda": "Edit agenda item", "Nama kegiatan": "Activity", "Contoh: Registrasi peserta": "e.g. Participant check-in", "Hari": "Day",
    "Jam mulai": "Start time", "Jam selesai": "End time", "Lokasi": "Location", "Nama tempat dan kota": "Place and city",
    "Lokasi dipakai untuk tautan peta dan petunjuk arah.": "Used for the map link and directions.", "Tautan peta dan catatan": "Map link and note",
    "Tautan Google Maps": "Google Maps link", "Simpan agenda": "Save item", "Hapus agenda": "Delete item", "Agenda tersimpan": "Item saved",
    "Hapus agenda \"{t}\"?": "Delete \"{t}\"?",
    /* diari */
    "Album perjalanan": "Trip album", "Ketuk tanggal untuk menambah foto. Ceritanya boleh ditulis belakangan.": "Tap a date to add photos. You can write the story later.",
    "{n} foto": ["{n} photo", "{n} photos"], "Hari perjalanan": "Trip days", "Belum ada foto": "No photos yet", " · ada cerita": " · has a story",
    "Kembali ke kalender": "Back to calendar",
    "Belum ada catatan. Ketuk untuk menulis.": "No caption yet. Tap to write one.",
    "Belum ada foto pada hari ini. Foto kegiatan, teman satu tim, atau tempat yang dikunjungi.": "No photos for this day yet. Capture the activities, your team, or the places you visit.",
    "Cerita hari ini": "Today's story", "Apa saja yang terjadi hari ini? Boleh diisi nanti.": "What happened today? You can fill this in later.",
    "Cerita tersimpan otomatis.": "Your story saves automatically.", "Agenda hari ini": "Today's agenda",
    "Mengunggah {n} foto…": ["Uploading {n} photo…", "Uploading {n} photos…"], "Satu foto gagal diunggah": "One photo failed to upload", "Foto berhasil ditambahkan": "Photos added",
    "Cerita tersimpan.": "Story saved.", "Cerita belum tersimpan. Periksa sinyal.": "Story not saved. Check your signal.", "Menyimpan…": "Saving…",
    "Foto dari kamera browser tidak otomatis masuk galeri HP. Ketuk \"Simpan ke galeri\" jika ingin menyimpan cadangan.": "Photos from the browser camera aren't saved to your phone's gallery automatically. Tap \"Save to gallery\" if you want a copy.",
    "Catatan foto": "Caption", "Siapa, di mana, sedang apa": "Who, where, doing what", "Simpan catatan": "Save note", "Hapus foto": "Delete photo",
    "Foto ini {by}.": "This photo was {by}.", "Catatan tersimpan": "Note saved", "Hapus foto ini dari diari?": "Delete this photo from the diary?",
    /* catatan */
    "AKSI": "ACTION", "SPASI": "SPACE", "Perbesar gambar": "Enlarge image",
    "Catatan perjalanan": "Trip notes", "Naskah, daftar periksa, dan tanya jawab. Bisa dibaca saat sinyal hilang setelah pernah dibuka.": "Scripts, checklists, and Q&A. Readable offline once you've opened them.",
    "Belum ada catatan. Simpan naskah presentasi, daftar barang bawaan, atau catatan rapat di sini.": "No notes yet. Keep a presentation script, packing list, or meeting notes here.",
    "Tulis catatan": "Write a note", "Saring menurut pembicara": "Filter by speaker", "Semua": "All", "Saring menurut kategori": "Filter by category",
    "Daftar isi": "Contents", "Buka semua jawaban": "Open all answers", "Tutup semua jawaban": "Close all answers",
    "Gambar ini belum tersimpan di HP. Buka catatan ini sekali saat ada sinyal.": "This image isn't saved on your phone yet. Open this note once while you have signal.",
    "Gambar belum bisa dimuat. Periksa sinyal, lalu buka lagi catatan ini.": "The image couldn't load. Check your signal, then open this note again.",
    "Gambar diperbesar": "Enlarged image", "Perbesar": "Zoom in", "Kecilkan": "Zoom out", "Tutup": "Close",
    "Semua catatan": "All notes", "Ubah catatan": "Edit note", "Catatan ini {by}.": "This note was {by}.", "Catatan baru": "New note",
    "Judul": "Title", "Contoh: Naskah presentasi": "e.g. Presentation script", "Isi": "Content", "Tulis di sini. Lihat cara memformat di bawah.": "Write here. Formatting tips are below.",
    "Cara memformat": "Formatting",
    "<p><b>## Subjudul</b>: masuk daftar isi.</p><p><b>[ANGEL] Slide 1 | 0.15</b>: blok bicara Angel dengan durasi; tutup dengan <b>---</b>.</p><p><b>&gt; Yoga: ketuk tombol</b>: baris aksi demo, tidak diucapkan.</p>": "<p><b>## Subheading</b>: added to the contents.</p><p><b>[ANGEL] Slide 1 | 0.15</b>: a speaking block for Angel with its duration; end it with <b>---</b>.</p><p><b>&gt; Yoga: tap the button</b>: a demo action line, not spoken.</p>",
    "<p><b>&gt;[ANGEL] klik tombol</b>: aksi untuk orang tertentu. <b>~ teks</b>: baris kecil tekan spasi.</p><p><b>??? Pertanyaan</b>: tanya jawab yang bisa dilipat; baris <b>[YOGA]</b> menandai penjawab, baris <b>%% Kategori</b> membuat tombol kategori.</p><p><b>- butir</b>, <b>| sel | sel |</b> untuk tabel, <b>! teks</b> untuk kotak penting, <b>**tebal**</b>.</p>": "<p><b>&gt;[ANGEL] click the button</b>: an action for one person. <b>~ text</b>: a small press-space line.</p><p><b>??? Question</b>: a collapsible Q&amp;A; a <b>[YOGA]</b> line marks who answers, a <b>%% Category</b> line adds a category filter.</p><p><b>- item</b>, <b>| cell | cell |</b> for tables, <b>! text</b> for a callout, <b>**bold**</b>.</p>",
    "Hapus catatan": "Delete note", "Judul belum diisi.": "Add a title.", "Hapus catatan \"{t}\"?": "Delete the note \"{t}\"?",
    /* luring */
    "Mode luring. Catatan di bawah ini salinan terakhir dan hanya bisa dibaca.": "Offline mode. These notes are the last saved copy and are read-only.", "Coba sambung lagi": "Try to reconnect",
    /* laporan */
    "No": "No", "Jenis": "Type", "Status": "Status", "Jumlah bukti": "Receipts", "Tautan bukti": "Receipt links", "Masuk§csv": "In", "Keluar": "Out", "Dibayar": "Paid",
    "Total dana masuk": "Total received", "Total sudah dibayar": "Total paid",
    "Laporan pertanggungjawaban": "Expense report", "Rekap transaksi dengan foto bukti sebagai lampiran.": "A summary of transactions with receipt photos attached.",
    "Laporan berisi rekap transaksi dan semua foto bukti sebagai lampiran. Buka laporan, lalu pilih <b>Simpan sebagai PDF</b> pada menu cetak. Format CSV dapat dibuka di Excel.": "The report lists every transaction with all receipt photos as attachments. Open it and choose <b>Save as PDF</b> in the print dialog. The CSV opens in Excel.",
    "Buka laporan PDF": "Open PDF report", "Unduh CSV": "Download CSV", "Ketuk transaksi untuk melampirkan foto.": "Tap a transaction to attach a photo.",
    "Semua pengeluaran yang sudah dibayar memiliki foto bukti. Laporan siap diserahkan.": "Every paid expense has a receipt photo. The report is ready to hand in.",
    "Perlu dicek": "Needs checking", "Laporan {t}": "Report {t}",
    "belum ada": "missing", "No.": "No.", "Uraian": "Description", "Bukti": "Receipt",
    "Laporan Penggunaan Dana": "Fund Usage Report", "{a} s.d. {b}": "{a} to {b}", "Disusun oleh: ": "Prepared by: ",
    "Dana diterima": "Funds received", "Total pengeluaran": "Total spent", "A. Dana diterima": "A. Funds received", "Jumlah": "Total",
    "B. Pengeluaran": "B. Expenses", "C. Rencana yang belum dibayar": "C. Planned, not paid yet", "Lampiran bukti": "Attachments",
    "Lampiran L{n}": "Attachment L{n}", "Foto bukti§pl": "Receipt photos", "bukti§file": "receipt", "Cetak atau simpan PDF": "Print or save as PDF",
    /* rute */
    "Perjalanan tidak ditemukan.": "Trip not found.", "Data belum bisa dimuat. Periksa sinyal, lalu coba lagi.": "Couldn't load the data. Check your signal and try again.",
    "Koneksi ke server gagal. Periksa sinyal, lalu coba lagi.": "Couldn't reach the server. Check your signal and try again."
  };

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
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 15h7M9 19h4"/>', dot: '<circle cx="12" cy="12" r="3"/>', coin: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.9 1 1.8 2.5 1.8 2.5-.7 2.5-1.7M12 6.5v1.3M12 16.2v1.3"/>'
  };
  function ic(n, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + I[n] + "</svg>"; }

  var OUT_CATS = ["Transport", "Penginapan", "Makan", "Cetak", "Lain-lain"];
  var IN_CATS = ["Dana kampus", "Sponsor", "Pribadi", "Lain-lain"];
  var CAT_IC = { Transport: "bus", Penginapan: "bed", Makan: "food", Cetak: "print" };

  /* ---------- karakter visual: warna kategori, ikon ilustratif, ilustrasi ---------- */
  var N = "#0E1F45";
  var CAT = {
    Transport: { c: "#2F7FD0", bg: "#DDEBFB" }, Penginapan: { c: "#E0604A", bg: "#FDE4DE" },
    Makan: { c: "#F0A21C", bg: "#FFF0CC" }, Cetak: { c: "#17998A", bg: "#D6F3EF" }, "Lain-lain": { c: "#7A88AA", bg: "#E8ECF4" }
  };
  var INC = { c: "#1E9E6A", bg: "#DCF3E8" };
  function catOf(e) { return e && e.kind === "in" ? INC : (CAT[e.category || e] || CAT["Lain-lain"]); }
  function catIcon(e) {
    var k = typeof e === "string" ? e : (e.kind === "in" ? "_in" : e.category), c = (k === "_in" ? INC : (CAT[k] || CAT["Lain-lain"])).c, p;
    if (k === "_in") p = '<circle cx="12" cy="12" r="9" fill="' + c + '"/><circle cx="12" cy="12" r="6.3" fill="none" stroke="#fff" stroke-width="1.3" stroke-dasharray="2 1.8"/><path d="M12 8.5v7M8.5 12h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
    else if (k === "Transport") p = '<rect x="4" y="3" width="16" height="15" rx="3.5" fill="' + c + '"/><rect x="6.5" y="5.5" width="11" height="5" rx="1.3" fill="#fff"/><circle cx="8" cy="14.3" r="1.4" fill="#fff"/><circle cx="16" cy="14.3" r="1.4" fill="#fff"/><rect x="6" y="17.5" width="3" height="3.5" rx="1" fill="' + N + '"/><rect x="15" y="17.5" width="3" height="3.5" rx="1" fill="' + N + '"/>';
    else if (k === "Penginapan") p = '<rect x="3" y="11" width="18" height="6.5" rx="2" fill="' + c + '"/><rect x="3" y="5" width="3" height="15" rx="1.3" fill="' + N + '"/><rect x="7.5" y="7.5" width="6" height="3.5" rx="1.6" fill="#fff" stroke="' + c + '" stroke-width="1.4"/><rect x="18.3" y="15" width="2.7" height="5" rx="1.1" fill="' + N + '"/>';
    else if (k === "Makan") p = '<path d="M3 11.5h18a9 8 0 01-18 0z" fill="' + c + '"/><rect x="8" y="19.2" width="8" height="2" rx="1" fill="' + N + '"/><path d="M9 9c0-2 2-2.3 2-4.5M13.5 9c0-2 2-2.3 2-4.5" stroke="' + N + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    else if (k === "Cetak") p = '<rect x="6.5" y="3" width="11" height="6" rx="1" fill="#fff" stroke="' + N + '" stroke-width="1.5"/><rect x="3" y="8" width="18" height="9" rx="2.6" fill="' + c + '"/><rect x="7" y="13" width="10" height="8" rx="1" fill="#fff" stroke="' + N + '" stroke-width="1.5"/><path d="M9 16h6M9 18.5h4" stroke="' + N + '" stroke-width="1.2"/><circle cx="17.6" cy="11" r="1" fill="#fff"/>';
    else p = '<path d="M3 8l9-4.2L21 8v9l-9 4.2L3 17z" fill="' + c + '"/><path d="M3 8l9 4.2L21 8M12 12.2V21" stroke="#fff" stroke-width="1.5" fill="none"/>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>";
  }
  /* ilustrasi kecil (dibuat sendiri, garis navy + isian palet) */
  var ART = {
    koper: '<rect x="40" y="34" width="80" height="58" rx="10" fill="#DDEBFB" stroke="#0E1F45" stroke-width="3"/><path d="M64 34v-8a6 6 0 016-6h20a6 6 0 016 6v8" fill="none" stroke="#0E1F45" stroke-width="3"/><path d="M58 34v58M102 34v58" stroke="#0E1F45" stroke-width="3"/><rect x="66" y="48" width="22" height="14" rx="3" fill="#FFD60A" stroke="#0E1F45" stroke-width="2.5" transform="rotate(-8 77 55)"/><circle cx="112" cy="76" r="8" fill="#FDE4DE" stroke="#0E1F45" stroke-width="2.5"/><circle cx="52" cy="96" r="4" fill="#0E1F45"/><circle cx="108" cy="96" r="4" fill="#0E1F45"/>',
    struk: '<path d="M52 18h52v74l-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5-6.5-5-6.5 5z" fill="#fff" stroke="#0E1F45" stroke-width="3" stroke-linejoin="round"/><path d="M62 34h32M62 44h24M62 54h28M62 70h32" stroke="#0E1F45" stroke-width="2.5" stroke-linecap="round" opacity=".55"/><circle cx="114" cy="74" r="16" fill="#FFD60A" stroke="#0E1F45" stroke-width="3"/><path d="M114 66v16M108 74h12" stroke="#0E1F45" stroke-width="3" stroke-linecap="round"/>',
    peta: '<path d="M28 26l34-8 36 10 34-8v70l-34 8-36-10-34 8z" fill="#D6F3EF" stroke="#0E1F45" stroke-width="3" stroke-linejoin="round"/><path d="M62 18v70M98 28v70" stroke="#0E1F45" stroke-width="2" opacity=".35"/><path d="M42 74c14-4 18-24 34-22s20 14 40-8" fill="none" stroke="#2F7FD0" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round"/><circle cx="42" cy="74" r="5" fill="#fff" stroke="#0E1F45" stroke-width="2.5"/><path d="M116 50s-11-11-11-19a11 11 0 0122 0c0 8-11 19-11 19z" fill="#E0604A" stroke="#0E1F45" stroke-width="2.5"/><circle cx="116" cy="31" r="4" fill="#fff"/>',
    kamera: '<rect x="34" y="34" width="92" height="58" rx="12" fill="#FDE4DE" stroke="#0E1F45" stroke-width="3"/><path d="M60 34l7-12h26l7 12" fill="#fff" stroke="#0E1F45" stroke-width="3" stroke-linejoin="round"/><circle cx="80" cy="63" r="18" fill="#fff" stroke="#0E1F45" stroke-width="3"/><circle cx="80" cy="63" r="9" fill="#2F7FD0"/><circle cx="76" cy="59" r="3" fill="#fff"/><rect x="108" y="42" width="10" height="6" rx="2" fill="#FFD60A" stroke="#0E1F45" stroke-width="2"/><path d="M128 18l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" fill="#FFD60A" stroke="#0E1F45" stroke-width="2" stroke-linejoin="round"/>'
  };
  ART.buku = '<rect x="42" y="16" width="70" height="84" rx="6" fill="#FFF0CC" stroke="#0E1F45" stroke-width="3"/><path d="M54 16v84" stroke="#0E1F45" stroke-width="3"/><path d="M64 36h36M64 48h36M64 60h26" stroke="#0E1F45" stroke-width="2.5" stroke-linecap="round" opacity=".55"/><rect x="96" y="10" width="12" height="26" fill="#E0604A" stroke="#0E1F45" stroke-width="2.5"/><path d="M96 36l6-6 6 6" fill="#E0604A" stroke="#0E1F45" stroke-width="2.5" stroke-linejoin="round"/><circle cx="122" cy="80" r="14" fill="#DDEBFB" stroke="#0E1F45" stroke-width="3"/><path d="M116 80h12M122 74v12" stroke="#2F7FD0" stroke-width="3" stroke-linecap="round"/>';
  function art(n, cls) { return '<svg class="art ' + (cls || "") + '" viewBox="0 0 160 110" aria-hidden="true">' + ART[n] + "</svg>"; }
  function emptyArt(n, text, btn) { return '<div class="empty art-empty">' + art(n) + "<p>" + text + "</p>" + (btn || "") + "</div>"; }
  function tabHero(n, title, sub) { return '<div class="tab-hero">' + art(n, "sm") + '<div><h2 class="disp">' + title + "</h2><p>" + sub + "</p></div></div>"; }
  /* cincin pemakaian dana per kategori */
  function ring(tot) {
    var keys = OUT_CATS.concat(Object.keys(tot.cats).filter(function (k) { return OUT_CATS.indexOf(k) < 0; })).filter(function (k) { return tot.cats[k]; });
    var base = Math.max(tot.in, tot.paid + tot.plan, 1), R = 42, C = 2 * Math.PI * R, off = 0, arcs = "";
    keys.forEach(function (k) {
      var col = (CAT[k] || CAT["Lain-lain"]).c, a = tot.cats[k].paid / base * C, b = tot.cats[k].plan / base * C;
      if (a > 0) { arcs += '<circle r="' + R + '" cx="55" cy="55" fill="none" stroke="' + col + '" stroke-width="14" stroke-dasharray="' + a + " " + (C - a) + '" stroke-dashoffset="' + (-off) + '"/>'; off += a; }
      if (b > 0) { arcs += '<circle r="' + R + '" cx="55" cy="55" fill="none" stroke="' + col + '" stroke-opacity=".35" stroke-width="14" stroke-dasharray="' + b + " " + (C - b) + '" stroke-dashoffset="' + (-off) + '"/>'; off += b; }
    });
    var pct = tot.in ? Math.round(tot.paid / tot.in * 100) : 0;
    return '<div class="ring-card"><svg class="ring" viewBox="0 0 110 110" aria-hidden="true"><g transform="rotate(-90 55 55)"><circle r="' + R + '" cx="55" cy="55" fill="none" stroke="#E6ECF5" stroke-width="14"/>' + arcs + '</g><text x="55" y="53" text-anchor="middle" class="ring-n">' + pct + '%</text><text x="55" y="68" text-anchor="middle" class="ring-l">' + T("terpakai") + '</text></svg>' +
      '<ul class="ring-leg">' + keys.map(function (k) { var c = tot.cats[k]; return '<li><span class="ci" style="background:' + (CAT[k] || CAT["Lain-lain"]).bg + '">' + catIcon(k) + "</span><span>" + esc(catName(k)) + '</span><b class="mono">' + rp(c.paid + c.plan) + "</b></li>"; }).join("") + '</ul></div><p class="hint" style="margin-top:8px">' + T("Warna pudar pada cincin menandai rencana yang belum dibayar.") + "</p>";
  }
  /* cap pos untuk tanggal diari */
  function postmark(day) {
    var d = dObj(day), top = d.toLocaleDateString(LOC(), { month: "short", timeZone: "UTC" }).toUpperCase().replace(".", "") + " " + d.getUTCFullYear();
    return '<svg class="postmark" viewBox="0 0 120 84" aria-hidden="true"><g fill="none" stroke="#C23B22" stroke-width="2"><circle cx="42" cy="42" r="34"/><circle cx="42" cy="42" r="27" stroke-dasharray="3 3"/>' +
      '<path d="M80 26c6-4 12 4 18 0s12 4 18 0M80 38c6-4 12 4 18 0s12 4 18 0M80 50c6-4 12 4 18 0s12 4 18 0M80 62c6-4 12 4 18 0s12 4 18 0"/></g>' +
      '<text x="42" y="40" text-anchor="middle" class="pm-d">' + d.getUTCDate() + '</text><text x="42" y="56" text-anchor="middle" class="pm-m">' + esc(top) + "</text></svg>";
  }
  /* angka sisa dana bergerak saat berubah */
  var lastLeft = {};
  function countUp(el, from, to) {
    if (!el || from === to || from == null || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var t0 = performance.now(), d = 650;
    (function step(now) { var k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = rp(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
  }

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
      img.onerror = function () { bad(new Error(T("Gambar tidak bisa dibaca"))); };
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
        file = new File([b], T("bukti§file") + "-" + Date.now() + ".jpg", { type: b.type || "image/jpeg" });
      } else if (!file.name || file.name === "image.jpg") {
        file = new File([file], T("bukti§file") + "-" + Date.now() + ".jpg", { type: file.type || "image/jpeg" });
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      toast(T("Foto sudah diunduh. Periksa folder Download atau galeri."));
    } catch (e) { if (e && e.name !== "AbortError") toast(T("Foto gagal disimpan.")); }
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
    mode = S.authMode = mode || "login";
    var signup = mode === "signup";
    $app.innerHTML =
      '<div class="auth"><div class="auth-top"><div class="brand">' + esc(BRAND) + '<b>.</b></div>' + langToggle() + '</div>' +
      '<p class="lead">' + T("Catat dana perjalanan, simpan foto struk, dan susun jadwal di satu tempat. Laporan pertanggungjawaban siap dicetak sepulang dinas atau lomba.") + '</p>' +
      '<div class="seg" style="margin-bottom:20px"><button data-m="login" class="' + (!signup ? "on" : "") + '">' + T("Masuk") + '</button><button data-m="signup" class="' + (signup ? "on" : "") + '">' + T("Daftar") + '</button></div>' +
      '<form id="af">' +
      (signup ? '<div class="f"><label for="nm">' + T("Nama") + '</label><input class="in-t" id="nm" autocomplete="name" placeholder="' + T("Nama yang tercantum di laporan") + '"></div>' : "") +
      '<div class="f"><label for="em">' + T("Email") + '</label><input class="in-t" id="em" type="email" autocomplete="email" required></div>' +
      '<div class="f"><label for="pw">' + T("Kata sandi") + '</label><input class="in-t" id="pw" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" required minlength="' + (signup ? 8 : 1) + '">' + (signup ? '<span class="hint">' + T("Minimal 8 karakter.") + '</span>' : "") + '</div>' +
      (signup ? '<div id="codeBox" hidden class="f"><label for="cd">' + T("Kode undangan") + '</label><input class="in-t mono" id="cd" autocapitalize="characters" autocomplete="off" placeholder="' + T("Boleh dikosongkan") + '"><span class="hint">' + T("Masukkan kode undangan atau kode ajakan dari rekan setim agar perjalanannya langsung muncul.") + '</span></div><button type="button" class="link-btn" id="codeT">' + T("Punya kode undangan atau kode ajakan?") + '</button>' : "") +
      '<div class="err" id="ae"></div><button class="btn pri block" type="submit">' + (signup ? T("Buat akun") : T("Masuk")) + '</button></form>' +
      '<p class="hint" style="margin-top:18px">' + (signup ? T('Sudah punya akun? <button type="button" class="link-btn" data-m="login">Masuk di sini</button>') : T('Belum punya akun? <button type="button" class="link-btn" data-m="signup">Daftar gratis</button>')) + "</p></div>";
    $app.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { renderAuth(b.dataset.m); }; });
    bindLang($app);
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
        er.textContent = T({ "bad-login": "Email atau kata sandi salah.", "email-taken": "Email ini sudah terdaftar. Silakan masuk.", "weak-password": "Kata sandi minimal 8 karakter.", "bad-email": "Format email belum benar.", "bad-code": "Kode undangan tidak dikenal atau sudah dipakai." }[x.message] || "Koneksi gagal. Periksa sinyal, lalu coba lagi.");
        btn.disabled = false;
      }
    };
  }

  /* ---------- karcis (kartu ringkasan) ---------- */
  function karcis(t, tot, big) {
    var days = tripDays(t).length;
    return '<div class="karcis"><div class="k-top"><div class="k-eyebrow"><span>' + esc(fmtDay(t.start_date, { day: "numeric", month: "short" })) + " – " + esc(fmtDay(t.end_date, { day: "numeric", month: "short", year: "numeric" })) + '</span><span>' + T("{n} hari", { n: days }) + " · " + esc(t.tz || "WIB") + '</span></div>' +
      '<div class="k-title disp">' + esc(t.title) + '</div>' + (t.place ? '<div class="k-route">' + ic("pin", ' width="14" height="14"') + esc(t.place) + '</div>' : "") + '<span class="barcode" aria-hidden="true"></span></div>' +
      '<div class="k-bot"><div class="k-eyebrow"><span>' + T("Sisa dana") + '</span></div><div class="k-big' + (tot.left < 0 ? " neg" : "") + '">' + rp(tot.left) + '</div>' +
      '<div class="k-sub">' + T("Dana masuk {a} · terpakai {b}", { a: rp(tot.in), b: rp(tot.paid) }) + "</div>" +
      (big && tot.plan ? '<div class="k-after">' + T("Setelah semua rencana dibayar:") + ' <b class="mono' + (tot.after < 0 ? " neg" : "") + '">' + rp(tot.after) + "</b></div>" : "") +
      "</div></div>";
  }

  /* ---------- beranda: daftar perjalanan ---------- */
  function stepsHTML(items) {
    return '<ol class="steps">' + items.map(function (s, i) {
      return '<li class="' + (s.done ? "done" : "") + '"><span class="n">' + (s.done ? ic("check") : i + 1) + '</span><span class="tx"><b>' + s.t + "</b>" + (s.d ? "<small>" + s.d + "</small>" : "") + "</span>" + (!s.done && s.btn ? '<button class="btn sm' + (s.pri ? " pri" : "") + '" data-step="' + i + '">' + s.btn + "</button>" : "") + "</li>";
    }).join("") + "</ol>";
  }
  async function renderHome() {
    $app.innerHTML = '<div class="wrap"><div class="top"><h1>' + esc(BRAND) + '<b>.</b></h1><button class="btn sm ghost" id="acc">' + T("Akun") + '</button></div><div id="tl" class="muted">' + T("Memuat…") + '</div></div>';
    document.getElementById("acc").onclick = accountSheet;
    var j = await api("/api/trips"); S.trips = j.trips;
    var el = document.getElementById("tl");
    if (!j.trips.length) {
      el.innerHTML = '<div class="welcome">' + art("koper") + '<h2 class="disp">' + T("Selamat datang") + (S.me && S.me.name ? ", " + esc(S.me.name) : "") + '.</h2><p>' + T("Mulai dalam tiga langkah berikut.") + '</p>' +
        stepsHTML([{ t: T("Buat perjalanan"), d: T("Nama acara, kota, dan tanggal."), btn: T("Buat perjalanan"), pri: true }, { t: T("Catat dana masuk"), d: T("Dana dari kampus, kantor, atau sponsor.") }, { t: T("Foto struk setiap membayar"), d: T("Bukti langsung tersimpan untuk laporan.") }]) + "</div>" +
        '<p class="hint" style="margin-top:14px">' + T("Punya kode undangan? Buka menu <b>Akun</b> di kanan atas.") + '</p>';
      el.querySelector("[data-step]").onclick = function () { tripSheet(null); };
      return;
    }
    el.innerHTML = '<div class="sec" style="margin-top:4px">' + T("Perjalanan saya") + '</div>' +
      j.trips.map(function (t) { return '<a class="trip-link" href="#/t/' + t.id + '/dana">' + (t.role === "member" ? '<span class="shared-tag">' + T("Dibagikan oleh {n}", { n: esc(t.owner_name || T("pemilik")) }) + "</span>" : "") + karcis(t, { in: t.total_in, paid: t.total_paid, plan: t.total_plan, left: t.total_in - t.total_paid }, false) + "</a>"; }).join("") +
      '<button class="btn block" id="nt">' + ic("plus") + T("Buat perjalanan baru") + "</button>";
    document.getElementById("nt").onclick = function () { tripSheet(null); };
  }
  function accountSheet() {
    var c = openSheet('<h2>' + T("Akun") + '</h2><p class="muted" style="margin:-8px 0 18px">' + esc(S.me.name || "") + (S.me.email ? " · " + esc(S.me.email) : "") + "</p>" +
      '<form id="cf" class="f"><label for="cc">' + T("Kode undangan atau kode ajakan") + '</label><div class="btns"><input class="in-t mono" id="cc" autocapitalize="characters" autocomplete="off" placeholder="' + T("Masukkan kode") + '" style="flex:2"><button class="btn" type="submit">' + T("Pakai kode") + '</button></div><span class="hint">' + T("Kode ajakan dari rekan setim membuat perjalanan mereka muncul di berandamu.") + '</span><span class="err" id="ce"></span></form>' +
      '<div class="f"><span class="lbl">' + T("Bahasa") + '</span>' + langToggle() + '</div>' +
      '<div class="menu-list"><a class="btn ghost block" href="/">' + T("Buka halaman depan") + '</a><button class="btn danger block" id="lo">' + T("Keluar dari akun") + '</button></div>');
    bindLang(c);
    c.querySelector("#cf").onsubmit = async function (e) {
      e.preventDefault();
      var code = c.querySelector("#cc").value.trim();
      if (!code) return;
      try { var cj = await api("/api/auth", { method: "POST", body: { action: "claim", code: code } }); closeSheet(); toast(cj.trip_id ? T("Kamu sudah bergabung ke perjalanan") : T("Kode berhasil dipakai. Datanya sudah masuk ke akunmu.")); S.trip = null; location.hash = cj.trip_id ? "#/t/" + cj.trip_id + "/dana" : "#/"; route(); }
      catch (x) { c.querySelector("#ce").textContent = T("Kode tidak dikenal atau sudah dipakai."); }
    };
    c.querySelector("#lo").onclick = async function () { await api("/api/auth", { method: "POST", body: { action: "logout" } }); offClear(); closeSheet(); S.me = null; location.hash = "#/"; renderAuth(); };
  }
  function tripSheet(t) {
    var c = openSheet("<h2>" + (t ? T("Ubah perjalanan") : T("Perjalanan baru")) + '</h2><form id="tf">' +
      '<div class="f"><label for="tt">' + T("Nama perjalanan") + '</label><input class="in-t" id="tt" required placeholder="' + T("Contoh: Final lomba desain di Bandung") + '" value="' + esc(t ? t.title : "") + '"></div>' +
      '<div class="f"><label for="tp">' + T("Kota atau tempat") + '</label><input class="in-t" id="tp" placeholder="' + T("Contoh: Institut Teknologi Bandung") + '" value="' + esc(t ? t.place : "") + '"></div>' +
      '<div class="two"><div class="f"><label for="ts">' + T("Tanggal mulai") + '</label><input class="in-t" id="ts" type="date" required value="' + esc(t ? t.start_date : todayWIB()) + '"></div><div class="f"><label for="te">' + T("Tanggal selesai") + '</label><input class="in-t" id="te" type="date" required value="' + esc(t ? t.end_date : todayWIB()) + '"></div></div>' +
      '<div class="f"><span class="lbl">' + T("Zona waktu di tujuan") + '</span><div class="seg" id="tz">' + ["WIB", "WITA", "WIT"].map(function (z) { return '<button type="button" data-z="' + z + '" class="' + ((t ? t.tz : "WIB") === z ? "on" : "") + '">' + z + "</button>"; }).join("") + "</div></div>" +
      '<div class="err" id="te2"></div><button class="btn pri block" type="submit">' + (t ? T("Simpan perubahan") : T("Buat perjalanan")) + "</button>" +
      (t ? shareHTML(t) + '<button type="button" class="btn danger block" id="td" style="margin-top:22px">' + T("Hapus perjalanan") + '</button>' : "") + "</form>");
    if (t) bindShare(c, t);
    var tz = t ? t.tz : "WIB";
    c.querySelectorAll("[data-z]").forEach(function (b) { b.onclick = function () { tz = b.dataset.z; c.querySelectorAll("[data-z]").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    c.querySelector("#tf").onsubmit = async function (e) {
      e.preventDefault();
      var body = { title: c.querySelector("#tt").value.trim(), place: c.querySelector("#tp").value.trim(), start_date: c.querySelector("#ts").value, end_date: c.querySelector("#te").value, tz: tz };
      if (body.end_date < body.start_date) { c.querySelector("#te2").textContent = T("Tanggal selesai tidak boleh sebelum tanggal mulai."); return; }
      e.target.querySelector("button[type=submit]").disabled = true;
      if (t) { await api("/api/trips?id=" + t.id, { method: "PATCH", body: body }); closeSheet(); await loadTrip(t.id); route(); toast(T("Perubahan tersimpan")); }
      else { var j = await api("/api/trips", { method: "POST", body: body }); closeSheet(); location.hash = "#/t/" + j.id + "/dana"; }
    };
    if (t) c.querySelector("#td").onclick = async function () {
      if (!confirm(T('Hapus "{t}" beserta semua transaksi, jadwal, dan diari? Tindakan ini tidak bisa dibatalkan.', { t: t.title }))) return;
      await api("/api/trips?id=" + t.id, { method: "DELETE" }); closeSheet(); S.trip = null; location.hash = "#/";
    };
  }

  /* ---------- berbagi perjalanan ---------- */
  function shared() { return S.trip && (S.trip.members || []).length > 1; }
  function canDel(item) { return !item || !S.trip || S.trip.role === "owner" || item.user_id === S.trip.me; }
  function byLine(item) {
    if (!shared() || !item || !item.user_id) return "";
    if (item.user_id === S.trip.me) return T("dicatat oleh kamu");
    var m = (S.trip.members || []).find(function (x) { return x.id === item.user_id; });
    return T("dicatat oleh {n}", { n: item.by_name || (m && m.name) || T("anggota lain") });
  }
  function membersHTML(t, owner) {
    return '<div class="members">' + (t.members || []).map(function (m) {
      return '<div class="mem"><span class="av">' + esc((m.name || "?").trim().charAt(0).toUpperCase()) + '</span><span class="mn">' + esc(m.name) + (m.id === t.me ? T(" (kamu)") : "") + "<small>" + (m.role === "owner" ? T("Pemilik") : T("Anggota")) + "</small></span>" +
        (owner && m.role !== "owner" ? '<button type="button" class="btn sm danger" data-kick="' + esc(m.id) + '">' + T("Keluarkan") + '</button>' : "") + "</div>";
    }).join("") + "</div>";
  }
  function shareHTML(t) {
    return '<div class="sec" style="margin-top:22px">' + T("Anggota perjalanan") + '</div>' + membersHTML(t, true) +
      '<div class="invite"><div class="cb-h">' + T("Ajak anggota") + '</div>' +
      (t.invite_code ? '<div class="code mono" id="ivc">' + esc(t.invite_code) + '</div><p class="hint">' + T("Kirim kode ini ke rekan setim. Mereka membuka <b>Akun</b>, lalu memasukkan kode pada kolom <b>Kode undangan atau kode ajakan</b>. Anggota bisa melihat, menambah, dan mengubah isi perjalanan ini.") + '</p>' +
        '<div class="btns"><button type="button" class="btn sm pri" id="ivs">' + ic("dl") + T("Bagikan kode") + '</button><button type="button" class="btn sm" id="ivn">' + T("Buat kode baru") + '</button><button type="button" class="btn sm danger" id="ivr">' + T("Cabut kode") + '</button></div>'
      : '<p class="hint">' + T("Buat kode ajakan agar rekan setim bisa masuk dengan akunnya sendiri dan mengisi perjalanan ini bersama.") + '</p><button type="button" class="btn sm pri" id="ivn">' + T("Buat kode ajakan") + '</button>') + "</div>";
  }
  function bindShare(c, t) {
    var act = async function (body) { var j = await api("/api/trips?id=" + t.id, { method: "POST", body: body }); await loadTrip(t.id); return j; };
    var reopen = function () { tripSheet(S.trip); };
    var n = c.querySelector("#ivn"); if (n) n.onclick = async function () { if (t.invite_code && !confirm(T("Buat kode baru? Kode lama tidak bisa dipakai lagi."))) return; await act({ action: "invite" }); reopen(); toast(T("Kode ajakan siap dibagikan")); };
    var r = c.querySelector("#ivr"); if (r) r.onclick = async function () { if (!confirm(T("Cabut kode ajakan? Anggota yang sudah bergabung tetap menjadi anggota."))) return; await act({ action: "revoke" }); reopen(); toast(T("Kode ajakan dicabut")); };
    var sh = c.querySelector("#ivs"); if (sh) sh.onclick = async function () {
      var text = T("Ayo isi catatan perjalanan \"{t}\" bersama di {b}. Buka {u}/app, masuk atau daftar, lalu buka Akun dan masukkan kode ajakan: {c}", { t: t.title, b: BRAND, u: location.origin, c: t.invite_code });
      try { if (navigator.share) { await navigator.share({ text: text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text); toast(T("Pesan ajakan tersalin")); } catch (e) { toast(T("Salin kode secara manual")); }
    };
    c.querySelectorAll("[data-kick]").forEach(function (b) { b.onclick = async function () { if (!confirm(T("Keluarkan anggota ini dari perjalanan?"))) return; await act({ action: "kick", user_id: b.dataset.kick }); reopen(); toast(T("Anggota dikeluarkan")); }; });
  }
  function memberSheet(t) {
    var c = openSheet('<h2>' + T("Anggota perjalanan") + '</h2><p class="muted" style="margin:-8px 0 14px">' + esc(t.title) + "</p>" + membersHTML(t, false) +
      '<p class="hint" style="margin-top:12px">' + T("Kamu bisa melihat, menambah, dan mengubah isi perjalanan ini. Judul, tanggal, kode ajakan, dan daftar anggota diatur oleh pemilik.") + '</p>' +
      '<button class="btn danger block" id="lv" style="margin-top:14px">' + T("Keluar dari perjalanan ini") + '</button>');
    c.querySelector("#lv").onclick = async function () {
      if (!confirm(T("Keluar dari perjalanan ini? Kamu perlu kode ajakan baru untuk bergabung lagi."))) return;
      await api("/api/trips?id=" + t.id, { method: "POST", body: { action: "leave" } }); closeSheet(); S.trip = null; location.hash = "#/"; toast(T("Kamu sudah keluar dari perjalanan"));
    };
  }

  /* ---------- kerangka perjalanan ---------- */
  async function loadTrip(id) { var j = await api("/api/trips?id=" + id); S.trip = j.trip; S.trip.day_notes = S.trip.day_notes || {}; S.trip.notes = S.trip.notes || []; saveOffline(S.trip); return S.trip; }
  function shell(t, tab, inner, fab) {
    var tabs = [["dana", T("Dana"), "wallet"], ["rundown", T("Jadwal"), "route"], ["diari", T("Diari"), "img"], ["catatan", T("Catatan"), "note"], ["lapor", T("Laporan"), "doc"]];
    $app.innerHTML = '<div class="wrap"><div class="top"><a class="back" href="#/" aria-label="' + T("Semua perjalanan") + '">' + ic("back", ' width="18" height="18"') + '</a><span class="top-t">' + esc(t.title) + '</span><button class="btn sm ghost" id="te">' + (t.role === "owner" ? T("Ubah") : T("Anggota")) + '</button></div><div class="view">' + inner + "</div></div>" +
      (fab ? '<button class="fab" id="fab">' + ic("plus") + "<span>" + esc(fab) + "</span></button>" : "") +
      '<nav class="tabbar" aria-label="' + T("Menu perjalanan") + '"><div class="in">' + tabs.map(function (x) { return '<a href="#/t/' + t.id + "/" + x[0] + '" class="' + (tab === x[0] ? "on" : "") + '"' + (tab === x[0] ? ' aria-current="page"' : "") + ">" + ic(x[2]) + x[1] + "</a>"; }).join("") + "</div></nav>";
    document.getElementById("te").onclick = function () { if (t.role === "owner") tripSheet(t); else memberSheet(t); };
  }

  /* ---------- DANA ---------- */
  function entryRow(e) {
    var isIn = e.kind === "in", n = (e.proofs || []).length, plan = e.status === "plan", cc = catOf(e);
    var proof = isIn ? "" : (n ? '<span class="tag ok">' + ic("clip") + T("{n} foto bukti", { n: n }) + "</span>" : (plan ? "" : '<span class="tag warn">' + ic("clip") + T("Belum ada foto bukti") + "</span>"));
    var stamp = isIn ? '<span class="stamp in">' + T("Diterima") + '</span>' : '<span class="stamp ' + (plan ? "plan" : "paid") + (S.pop === e.id ? " pop" : "") + '">' + (plan ? T("Rencana") : T("Lunas")) + "</span>";
    return '<button class="row" data-e="' + e.id + '"><span class="ci" style="background:' + cc.bg + '">' + catIcon(e) + '</span><span class="mid"><span class="t">' + esc(e.title) + '</span><span class="s">' +
      "<span>" + esc(catName(e.category)) + (e.date ? " · " + esc(fmtDay(e.date, { day: "numeric", month: "short" })) : "") + (byLine(e) ? " · " + esc(byLine(e)) : "") + "</span>" + proof +
      (e.flag ? '<span class="flag">' + esc(e.flag) + "</span>" : "") + '</span></span><span class="amt-col"><span class="amt' + (isIn ? " in" : "") + '">' + (isIn ? "+" : "") + rp(e.amount) + "</span>" + stamp + "</span></button>";
  }
  function listBlock(title, list, empty) {
    var sum = list.reduce(function (a, e) { return a + e.amount; }, 0);
    return '<div class="sec">' + title + '<span class="act mono">' + (list.length ? rp(sum) : "") + "</span></div>" + (list.length ? '<div class="list">' + list.map(entryRow).join("") + "</div>" : (empty ? emptyArt(arguments[3] || "struk", empty) : ""));
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
      { t: T("Catat dana masuk"), d: T("Dana dari kampus, kantor, atau sponsor."), done: ins.length > 0, btn: T("Catat"), act: function () { entrySheet(null, "in"); } },
      { t: T("Catat pengeluaran pertama"), d: T("Tiket, penginapan, makan, atau cetak."), done: outs.length > 0, btn: T("Catat"), act: function () { entrySheet(null, "out"); } },
      { t: T("Lampirkan foto bukti"), d: T("Foto struk, nota, atau tiket."), done: hasProof, btn: T("Foto struk"), act: quickPhoto }
    ];
    if (steps.some(function (s) { return !s.done; })) html += '<div class="card-box"><div class="cb-h">' + T("Langkah awal") + '</div>' + stepsHTML(steps.map(function (s, i) { var o = Object.assign({}, s); o.pri = !s.done && steps.slice(0, i).every(function (x) { return x.done; }); return o; })) + "</div>";
    html += '<div class="qa"><button class="btn pri" id="qPhoto">' + ic("cam") + T("Foto struk") + '</button><button class="btn" id="qManual">' + ic("plus") + T("Catat manual") + "</button></div>";
    if (tot.noProof.length) html += '<a class="warn-card" href="#/t/' + t.id + '/lapor">' + ic("clip") + "<span>" + T("<b>{n} pengeluaran belum punya foto bukti.</b> Ketuk untuk melihat daftarnya.", { n: tot.noProof.length }) + "</span></a>";
    if (left && tot.in) {
      var makanPlan = (tot.cats.Makan || {}).plan || 0;
      var perDay = Math.max(0, Math.floor((tot.after + makanPlan) / left / 1000) * 1000);
      var inTrip = days.indexOf(today) >= 0;
      var eatToday = outs.filter(function (e) { return e.category === "Makan" && e.status !== "plan" && e.date === today; }).reduce(function (a, e) { return a + e.amount; }, 0);
      var pctEat = perDay ? Math.min(100, Math.round(eatToday / perDay * 100)) : 0;
      html += '<div class="meal"><span class="ci big" style="background:' + CAT.Makan.bg + '">' + catIcon("Makan") + '</span><div class="meal-t"><div class="cb-h">' + (inTrip ? T("Jatah makan hari ini") : T("Jatah makan per hari")) + '</div><b class="mono">' + rp(inTrip ? Math.max(0, perDay - eatToday) : perDay) + "</b><small>" + (inTrip ? T("tersisa dari {a} · terpakai {b}", { a: rp(perDay), b: rp(eatToday) }) : T("untuk {n} hari perjalanan, setelah rencana lain dibayar", { n: left })) + "</small>" +
        (inTrip ? '<span class="meal-bar' + (eatToday > perDay ? " over" : "") + '"><i style="width:' + pctEat + '%"></i></span>' : "") + "</div></div>" +
        (S.ai ? '<div><button class="btn sm ghost" id="adv" style="margin-top:10px">' + ic("spark") + T("Minta saran anggaran") + '</button></div><div class="ai-out" id="advo"></div>' : "");
    }
    if (Object.keys(tot.cats).length) html += '<div class="sec">' + T("Pemakaian dana") + '</div>' + ring(tot);
    html += listBlock(T("Sudah dibayar"), paid, T("Belum ada pengeluaran yang dibayar. Ketuk <b>Foto struk</b> setiap kali membayar."));
    if (plan.length) html += listBlock(T("Rencana, belum dibayar"), plan, "");
    html += listBlock(T("Dana masuk"), ins, T("Catat dana dari kampus, kantor, atau sponsor agar sisa dana terhitung."), "koper");
    shell(t, "dana", html, "");
    countUp($app.querySelector(".k-big"), lastLeft[t.id], tot.left); lastLeft[t.id] = tot.left;
    if (S.pop) setTimeout(function () { S.pop = null; }, 50);
    document.getElementById("qPhoto").onclick = quickPhoto;
    document.getElementById("qManual").onclick = function () { entrySheet(null, "out"); };
    $app.querySelectorAll("[data-step]").forEach(function (b) { b.onclick = steps[+b.dataset.step].act; });
    $app.querySelectorAll("[data-e]").forEach(function (b) { b.onclick = function () { entrySheet(t.entries.find(function (e) { return e.id === b.dataset.e; })); }; });
    var adv = document.getElementById("adv");
    if (adv) adv.onclick = async function () {
      adv.disabled = true; adv.innerHTML = ic("spark") + T("Sedang menghitung…");
      try { var j = await api("/api/ai", { method: "POST", body: { action: "advise", trip_id: t.id } }); document.getElementById("advo").textContent = j.text || T("Saran belum tersedia. Coba lagi sebentar."); }
      catch (e) { document.getElementById("advo").textContent = T("Saran belum bisa dibuat sekarang."); }
      adv.disabled = false; adv.innerHTML = ic("spark") + T("Minta saran lagi");
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
    var c = openSheet('<h2>' + (isNew ? (st.kind === "in" ? T("Catat dana masuk") : T("Catat pengeluaran")) : T("Ubah transaksi")) + '</h2><form id="ef">' +
      '<div class="seg" id="kd" style="margin-bottom:14px"><button type="button" data-k="out" class="out">' + T("Pengeluaran") + '</button><button type="button" data-k="in" class="in">' + T("Dana masuk") + '</button></div>' +
      '<div class="f"><label for="ea">' + T("Nominal") + '</label><input class="in-t in-amt" id="ea" inputmode="numeric" autocomplete="off" placeholder="Rp0"></div>' +
      '<div class="f"><label for="et">' + T("Keterangan") + '</label><input class="in-t" id="et" required></div>' +
      '<div class="f" id="pf"><span class="lbl">' + T("Foto bukti") + '</span><div class="btns"><button type="button" class="btn sm" id="pc">' + ic("cam") + T("Ambil foto") + '</button><button type="button" class="btn sm" id="pg">' + ic("img") + T("Pilih dari galeri") + "</button>" + (S.ai ? '<button type="button" class="btn sm" id="ps">' + ic("scan") + T("Baca struk") + "</button>" : "") + '</div><div class="proofs" id="pp"></div><span class="hint" id="ph"></span></div>' +
      '<div class="f" id="sw"><span class="lbl">' + T("Status pembayaran") + '</span><div class="seg" id="es"><button type="button" data-s="paid">' + T("Sudah dibayar") + '</button><button type="button" data-s="plan">' + T("Belum, masih rencana") + '</button></div></div>' +
      '<div class="f"><span class="lbl">' + T("Kategori") + '</span><div class="chips" id="ec"></div></div>' +
      '<details class="more"' + (e && (e.note || e.flag) ? " open" : "") + '><summary>' + T("Tanggal dan catatan") + '</summary>' +
      '<div class="f"><label for="ed">' + T("Tanggal") + '</label><input class="in-t" id="ed" type="date"></div>' +
      '<div class="f"><label for="en">' + T("Catatan§f") + '</label><textarea class="in-t" id="en" placeholder="' + T("Boleh dikosongkan") + '"></textarea></div>' +
      (e && e.flag ? '<div class="f"><label for="ef2">' + T("Tanda perlu dicek") + '</label><input class="in-t" id="ef2"><span class="hint">' + T("Kosongkan jika sudah beres.") + '</span></div>' : "") + "</details>" +
      '<div class="err" id="ee"></div><div class="save-bar"><button class="btn pri block" type="submit">' + T("Simpan") + '</button></div>' + (isNew || !canDel(e) ? "" : '<button type="button" class="btn danger block" id="edel" style="margin-top:10px">' + T("Hapus transaksi") + '</button>') + (!isNew && byLine(e) ? '<p class="hint" style="margin-top:10px;text-align:center">' + T("Transaksi ini {by}.", { by: esc(byLine(e)) }) + "</p>" : "") + "</form>");
    var $a = c.querySelector("#ea");
    function setAmt(v) { $a.value = v ? "Rp" + Number(v).toLocaleString("id-ID") : ""; }
    $a.oninput = function () { var p = $a.selectionStart, L = $a.value.length; setAmt(digits($a.value)); var d = $a.value.length - L; try { $a.setSelectionRange(p + d, p + d); } catch (x) {} };
    setAmt(st.amount);
    c.querySelector("#et").value = st.title; c.querySelector("#ed").value = st.date || ""; c.querySelector("#en").value = st.note || "";
    if (c.querySelector("#ef2")) c.querySelector("#ef2").value = st.flag || "";
    function paint() {
      c.querySelector("h2").textContent = isNew ? (isIn() ? T("Catat dana masuk") : T("Catat pengeluaran")) : T("Ubah transaksi");
      c.querySelector("#et").placeholder = isIn() ? T("Contoh: Dana lomba dari kampus") : T("Contoh: Ojek daring ke hotel");
      c.querySelectorAll("[data-k]").forEach(function (b) { b.classList.toggle("on", b.dataset.k === st.kind); });
      var cats = isIn() ? IN_CATS : OUT_CATS;
      if (cats.indexOf(st.category) < 0 && !(e && e.kind === st.kind)) st.category = cats[0];
      if (cats.indexOf(st.category) < 0) cats = cats.concat(st.category);
      c.querySelector("#ec").innerHTML = cats.map(function (k) { return '<button type="button" class="chip' + (k === st.category ? " on" : "") + '" data-c="' + esc(k) + '">' + esc(catName(k)) + "</button>"; }).join("");
      c.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { st.category = b.dataset.c; paint(); }; });
      c.querySelector("#sw").hidden = isIn();
      c.querySelector("#pf .lbl").textContent = isIn() ? T("Foto bukti (opsional)") : T("Foto bukti");
      c.querySelectorAll("[data-s]").forEach(function (b) { b.classList.toggle("on", b.dataset.s === st.status); });
    }
    c.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { st.kind = b.dataset.k; if (isIn()) st.status = "paid"; paint(); }; });
    c.querySelectorAll("[data-s]").forEach(function (b) { b.onclick = function () { st.status = b.dataset.s; paint(); }; });
    paint();

    var $pp = c.querySelector("#pp"), $ph = c.querySelector("#ph"), pending = 0, fromCam = {}, removed = [];
    function paintProofs() {
      $pp.innerHTML = st.proofs.map(function (p, i) { return '<div class="proof"><a href="' + esc(p.url) + '" target="_blank" rel="noopener"><img src="' + esc(p.url) + '" alt="' + T("Foto bukti {n}", { n: i + 1 }) + '" loading="lazy"></a><button type="button" class="x" data-x="' + i + '" aria-label="' + T("Hapus foto bukti") + '">' + ic("x") + '</button><button type="button" class="sv" data-sv="' + i + '">' + (fromCam[p.url] ? T("Simpan ke galeri") : T("Unduh")) + "</button></div>"; }).join("") +
        Array(pending + 1).join('<div class="proof loading"></div>');
      $pp.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () { if (confirm(T("Hapus foto bukti ini?"))) { var p = st.proofs.splice(+b.dataset.x, 1)[0]; removed.push(p.url); paintProofs(); } }; });
      $pp.querySelectorAll("[data-sv]").forEach(function (b) { b.onclick = function () { saveToGallery(st.proofs[+b.dataset.sv].url); }; });
      $ph.textContent = pending ? T("Mengunggah foto…") : (Object.keys(fromCam).length ? T("Foto dari kamera tidak otomatis masuk galeri HP. Ketuk \"Simpan ke galeri\" untuk menyimpan cadangan.") : "");
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
              st.kind = "out"; st.status = "paid"; paint(); toast(T("Struk berhasil dibaca. Periksa kembali nominalnya."));
            } else toast(T("Struk tidak terbaca. Isi nominal secara manual."));
          }
        } catch (x) { toast(T("Foto gagal diunggah. Coba lagi.")); }
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
      if (pending) { er.textContent = T("Tunggu sampai foto selesai diunggah."); return; }
      var body = { kind: st.kind, category: st.category, title: c.querySelector("#et").value.trim(), amount: digits($a.value), status: isIn() ? "paid" : st.status, date: c.querySelector("#ed").value || null, note: c.querySelector("#en").value, proofs: st.proofs };
      if (c.querySelector("#ef2")) body.flag = c.querySelector("#ef2").value.trim();
      if (!body.amount) { er.textContent = T("Nominal belum diisi."); $a.focus(); return; }
      if (!body.title) { er.textContent = T("Keterangan belum diisi."); c.querySelector("#et").focus(); return; }
      ev.target.querySelector("button[type=submit]").disabled = true;
      try {
        if (isNew) { body.trip_id = t.id; var j = await api("/api/items?t=entries", { method: "POST", body: body }); t.entries.push(j.item); S.pop = j.item.id; }
        else { var j2 = await api("/api/items?t=entries&id=" + e.id, { method: "PATCH", body: body }); if (e.status !== j2.item.status || isNew) S.pop = e.id; Object.assign(e, j2.item); }
        removed.forEach(function (u) { api("/api/upload?url=" + encodeURIComponent(u), { method: "DELETE" }).catch(function () {}); });
        closeSheet(); renderDana(t); toast(isNew ? T("Transaksi tercatat") : T("Perubahan tersimpan"));
      } catch (x) { er.textContent = T("Gagal menyimpan. Periksa sinyal, lalu coba lagi."); ev.target.querySelector("button[type=submit]").disabled = false; }
    };
    if (c.querySelector("#edel")) c.querySelector("#edel").onclick = async function () {
      if (!confirm(T('Hapus "{t}"? Foto buktinya ikut terhapus.', { t: e.title }))) return;
      await api("/api/items?t=entries&id=" + e.id, { method: "DELETE" });
      (e.proofs || []).forEach(function (p) { api("/api/upload?url=" + encodeURIComponent(p.url), { method: "DELETE" }).catch(function () {}); });
      t.entries = t.entries.filter(function (x) { return x.id !== e.id; }); closeSheet(); renderDana(t); toast(T("Transaksi terhapus"));
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
    var html = tabHero("peta", T("Jadwal perjalanan"), T("Agenda per jam, lengkap dengan lokasi dan petunjuk arah.")) + '<div class="days">' + days.map(function (d) { return '<button class="day-chip' + (d === S.day ? " on" : "") + '" data-d="' + d + '"><b>' + esc(fmtDay(d, { weekday: "long" })) + "</b><small>" + esc(fmtDay(d, { day: "numeric", month: "short" })) + "</small></button>"; }).join("") + "</div>";
    if (!list.length) html += emptyArt("peta", T("Belum ada agenda pada hari ini."), '<button class="btn pri" id="addFirst">' + ic("plus") + T("Tambah agenda") + "</button>");
    else html += '<div class="route">' + list.map(function (s, i) {
      var cls = i === nowIdx ? " now" : (S.day < today || (S.day === today && i < nowIdx) ? " past" : "");
      var prev = list[i - 1], leg = "";
      if (prev && prev.place && s.place && prev.place !== s.place) leg = '<div class="stop"><span></span><span class="rail"></span><div class="leg"><a href="' + esc(dirUrl(prev.place, s.place)) + '" target="_blank" rel="noopener">' + ic("nav") + T("Petunjuk arah") + "</a></div></div>";
      var mu = mapsUrl(s);
      return leg + '<div class="stop' + cls + '"><div class="tm">' + esc(hhmm(s.start_t) || "–") + (s.end_t ? "<small>" + esc(hhmm(s.end_t)) + "</small>" : "") + '</div><div class="rail"><span class="dot"></span></div><div class="card" role="button" tabindex="0" data-s="' + s.id + '"><div class="t">' + esc(s.title) + (i === nowIdx ? '<span class="now-tag">' + T("SEKARANG") + '</span>' : "") + "</div>" +
        (s.place ? '<a class="pl" href="' + esc(mu) + '" target="_blank" rel="noopener">' + ic("pin") + esc(s.place) + "</a>" : "") + (s.note ? '<div class="nt">' + esc(s.note) + "</div>" : "") + "</div></div>";
    }).join("") + "</div>";
    html += '<p class="hint" style="margin-top:16px">' + T('Jam memakai {tz}, kecuali disebutkan lain pada agenda. Ketuk agenda untuk mengubahnya. Tombol "Petunjuk arah" membuka rute dan perkiraan waktu tempuh di Google Maps.', { tz: esc(t.tz || "WIB") }) + "</p>";
    shell(t, "rundown", html, T("Agenda"));
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
    var c = openSheet("<h2>" + (isNew ? T("Tambah agenda") : T("Ubah agenda")) + '</h2><form id="sf">' +
      '<div class="f"><label for="st">' + T("Nama kegiatan") + '</label><input class="in-t" id="st" required placeholder="' + T("Contoh: Registrasi peserta") + '"></div>' +
      '<div class="f"><label for="sd">' + T("Hari") + '</label><select class="in-t" id="sd">' + tripDays(t).concat(tripDays(t).indexOf(s.day) < 0 ? [s.day] : []).map(function (d) { return '<option value="' + d + '"' + (d === s.day ? " selected" : "") + ">" + esc(fmtDay(d, { weekday: "long", day: "numeric", month: "long" })) + "</option>"; }).join("") + "</select></div>" +
      '<div class="two"><div class="f"><label for="s1">' + T("Jam mulai") + '</label><input class="in-t mono" id="s1" type="time"></div><div class="f"><label for="s2">' + T("Jam selesai") + '</label><input class="in-t mono" id="s2" type="time"></div></div>' +
      '<div class="f"><label for="sp">' + T("Lokasi") + '</label><input class="in-t" id="sp" placeholder="' + T("Nama tempat dan kota") + '"><span class="hint">' + T("Lokasi dipakai untuk tautan peta dan petunjuk arah.") + '</span></div>' +
      '<details class="more"' + (s.maps_url || s.note ? " open" : "") + '><summary>' + T("Tautan peta dan catatan") + '</summary>' +
      '<div class="f"><label for="su">' + T("Tautan Google Maps") + '</label><input class="in-t" id="su" type="url" placeholder="https://maps.app.goo.gl/…"></div>' +
      '<div class="f"><label for="sn">' + T("Catatan§f") + '</label><textarea class="in-t" id="sn"></textarea></div></details>' +
      '<div class="save-bar"><button class="btn pri block" type="submit">' + T("Simpan agenda") + '</button></div>' + (isNew || !canDel(s) ? "" : '<button type="button" class="btn danger block" id="sdel" style="margin-top:10px">' + T("Hapus agenda") + '</button>') + "</form>");
    c.querySelector("#st").value = s.title; c.querySelector("#s1").value = s.start_t; c.querySelector("#s2").value = s.end_t;
    c.querySelector("#sp").value = s.place; c.querySelector("#su").value = s.maps_url; c.querySelector("#sn").value = s.note;
    c.querySelector("#sf").onsubmit = async function (ev) {
      ev.preventDefault(); ev.target.querySelector("button[type=submit]").disabled = true;
      var body = { title: c.querySelector("#st").value.trim(), day: c.querySelector("#sd").value, start_t: c.querySelector("#s1").value, end_t: c.querySelector("#s2").value, place: c.querySelector("#sp").value.trim(), maps_url: c.querySelector("#su").value.trim(), note: c.querySelector("#sn").value };
      if (isNew) { body.trip_id = t.id; body.sort = t.stops.length; t.stops.push((await api("/api/items?t=stops", { method: "POST", body: body })).item); }
      else Object.assign(s, (await api("/api/items?t=stops&id=" + s.id, { method: "PATCH", body: body })).item);
      S.day = body.day; closeSheet(); renderRundown(t); toast(T("Agenda tersimpan"));
    };
    if (c.querySelector("#sdel")) c.querySelector("#sdel").onclick = async function () {
      if (!confirm(T('Hapus agenda "{t}"?', { t: s.title }))) return;
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
    var html = tabHero("kamera", T("Album perjalanan"), T("Ketuk tanggal untuk menambah foto. Ceritanya boleh ditulis belakangan."));
    html += months.map(function (m) {
      var first = dObj(m + "-01"), dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), pad = (first.getUTCDay() + 6) % 7;
      var cells = (LANG === "en" ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] : ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"]).map(function (w) { return '<div class="wd">' + w + "</div>"; }).join("");
      for (var i = 0; i < pad; i++) cells += '<div class="cell blank"></div>';
      for (var d = 1; d <= dim; d++) {
        var ds = m + "-" + (d < 10 ? "0" : "") + d, ph = by[ds] || [];
        cells += '<button class="cell' + (ph.length ? " has" : "") + (days.indexOf(ds) >= 0 ? " trip" : "") + (ds === today ? " today" : "") + '" data-day="' + ds + '" aria-label="' + esc(fmtDay(ds, { day: "numeric", month: "long" })) + (ph.length ? ", " + T("{n} foto", { n: ph.length }) : "") + '">' + (ph.length ? '<img src="' + esc(ph[0].url) + '" alt="" loading="lazy"><em>' + ph.length + '</em><i class="pm" aria-hidden="true"></i>' : "") + "<span>" + d + "</span></button>";
      }
      return '<div class="cal" style="margin-bottom:14px"><h3>' + esc(first.toLocaleDateString(LOC(), { month: "long", year: "numeric", timeZone: "UTC" })) + '</h3><div class="cal-g">' + cells + '</div><div class="legend" style="margin-top:10px"><span><i class="tripd"></i>' + T("Hari perjalanan") + "</span></div></div>";
    }).join("");
    html += '<div class="sec">' + T("Hari perjalanan") + '</div><div class="list">' + days.map(function (d) {
      var n = (by[d] || []).length, note = (t.day_notes || {})[d];
      return '<button class="row" data-day="' + d + '"><span class="ic">' + ic("img") + '</span><span class="mid"><span class="t">' + esc(fmtDay(d, { weekday: "long", day: "numeric", month: "long" })) + '</span><span class="s">' + (n ? T("{n} foto", { n: n }) : T("Belum ada foto")) + (note ? T(" · ada cerita") : "") + "</span></span></button>";
    }).join("") + "</div>";
    shell(t, "diari", html, "");
    $app.querySelectorAll("[data-day]").forEach(function (b) { b.onclick = function () { location.hash = "#/t/" + t.id + "/diari/" + b.dataset.day; }; });
  }
  function renderDay(t, day) {
    var ms = t.moments.filter(function (m) { return m.day === day; });
    var runs = t.stops.filter(function (s) { return s.day === day; }).sort(function (a, b) { return (a.start_t || "99").localeCompare(b.start_t || "99"); });
    var html = '<a class="link-back" href="#/t/' + t.id + '/diari">' + ic("back", ' width="16" height="16"') + T("Kembali ke kalender") + '</a><div class="day-top">' + postmark(day) + '<div><div class="day-head disp">' + esc(fmtDay(day, { weekday: "long" })) + '</div><p class="muted" style="margin:2px 0 0;font-size:14px">' + esc(fmtDay(day, { day: "numeric", month: "long", year: "numeric" })) + " · " + T("{n} foto", { n: ms.length }) + "</p></div></div>" +
      '<div class="btns" style="margin-bottom:16px"><button class="btn pri" id="dc">' + ic("cam") + T("Ambil foto") + '</button><button class="btn" id="dg">' + ic("img") + T("Pilih dari galeri") + "</button></div>" +
      (ms.length ? '<div class="photos" id="pl">' + ms.map(function (m, i) { return '<button class="ph" style="--r:' + [-2.2, 1.6, -1, 2.4][i % 4] + 'deg" data-m="' + m.id + '"><img src="' + esc(m.url) + '" alt="" loading="lazy"><p class="' + (m.caption ? "" : "later") + '">' + (m.caption ? esc(m.caption) : T("Belum ada catatan. Ketuk untuk menulis.")) + "</p>" + (byLine(m) ? '<small class="by">' + esc(byLine(m)) + "</small>" : "") + "</button>"; }).join("") + "</div>" : emptyArt("kamera", T("Belum ada foto pada hari ini. Foto kegiatan, teman satu tim, atau tempat yang dikunjungi."))) +
      '<div class="sec">' + T("Cerita hari ini") + '</div><textarea class="in-t" id="dn" placeholder="' + T("Apa saja yang terjadi hari ini? Boleh diisi nanti.") + '">' + esc((t.day_notes || {})[day] || "") + "</textarea><p class=\"hint\" id=\"dns\">" + T("Cerita tersimpan otomatis.") + "</p>" +
      (runs.length ? '<div class="sec">' + T("Agenda hari ini") + '</div><div class="mini-run">' + runs.map(function (s) { return "<div><b>" + esc(hhmm(s.start_t) || "–") + "</b>" + esc(s.title) + "</div>"; }).join("") + "</div>" : "");
    shell(t, "diari", html, "");
    var up = async function (files, cam) {
      if (!files.length) return;
      toast(T("Mengunggah {n} foto…", { n: files.length }), 60000);
      for (var i = 0; i < files.length; i++) {
        try {
          var r = await uploadFile(files[i], "diari");
          var j = await api("/api/items?t=moments", { method: "POST", body: { trip_id: t.id, day: day, url: r.url, caption: "" } });
          t.moments.push(j.item);
        } catch (x) { toast(T("Satu foto gagal diunggah")); }
      }
      renderDay(t, day);
      if (cam) { var last = t.moments[t.moments.length - 1]; if (last) momentSheet(last, true); }
      else toast(T("Foto berhasil ditambahkan"));
    };
    document.getElementById("dc").onclick = async function () { up(await pickFiles({ camera: true }), true); };
    document.getElementById("dg").onclick = async function () { up(await pickFiles({ multiple: true }), false); };
    $app.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { momentSheet(t.moments.find(function (m) { return m.id === b.dataset.m; })); }; });
    var dn = document.getElementById("dn"), timer;
    var saveNote = async function () {
      t.day_notes = Object.assign({}, t.day_notes); t.day_notes[day] = dn.value;
      try { await api("/api/trips?id=" + t.id, { method: "PATCH", body: { day_notes: t.day_notes } }); document.getElementById("dns").textContent = T("Cerita tersimpan."); }
      catch (x) { document.getElementById("dns").textContent = T("Cerita belum tersimpan. Periksa sinyal."); }
    };
    dn.oninput = function () { document.getElementById("dns").textContent = T("Menyimpan…"); clearTimeout(timer); timer = setTimeout(saveNote, 900); };
  }
  function momentSheet(m, justShot) {
    var t = S.trip;
    var c = openSheet('<div class="viewer"><img src="' + esc(m.url) + '" alt=""></div>' +
      (justShot ? '<p class="hint" style="margin:10px 0 0">' + T('Foto dari kamera browser tidak otomatis masuk galeri HP. Ketuk "Simpan ke galeri" jika ingin menyimpan cadangan.') + "</p>" : "") +
      '<div class="f" style="margin-top:14px"><label for="mc">' + T("Catatan foto") + '</label><textarea class="in-t" id="mc" placeholder="' + T("Siapa, di mana, sedang apa") + '">' + esc(m.caption) + "</textarea></div>" +
      '<div class="btns"><button class="btn pri" id="ms">' + T("Simpan catatan") + '</button><button class="btn" id="mg">' + ic("dl") + T("Simpan ke galeri") + '</button></div>' + (canDel(m) ? '<button class="btn danger block" id="md" style="margin-top:10px">' + T("Hapus foto") + "</button>" : "") + (byLine(m) ? '<p class="hint" style="margin-top:10px;text-align:center">' + T("Foto ini {by}.", { by: esc(byLine(m)) }) + "</p>" : ""));
    c.querySelector("#ms").onclick = async function () {
      var j = await api("/api/items?t=moments&id=" + m.id, { method: "PATCH", body: { caption: c.querySelector("#mc").value } });
      Object.assign(m, j.item); closeSheet(); renderDay(t, m.day); toast(T("Catatan tersimpan"));
    };
    c.querySelector("#mg").onclick = function () { saveToGallery(m.url); };
    if (c.querySelector("#md")) c.querySelector("#md").onclick = async function () {
      if (!confirm(T("Hapus foto ini dari diari?"))) return;
      await api("/api/items?t=moments&id=" + m.id, { method: "DELETE" });
      api("/api/upload?url=" + encodeURIComponent(m.url), { method: "DELETE" }).catch(function () {});
      t.moments = t.moments.filter(function (x) { return x.id !== m.id; }); closeSheet(); renderDay(t, m.day);
    };
  }

  /* ---------- CATATAN ----------
     Format teks sederhana, satu perintah per baris:
       # Judul besar          ## Subjudul (masuk daftar isi)       === Penanda babak
       [ANGEL] Judul | 0.15   blok pembicara (ANGEL/YOGA/nama lain) sampai baris --- atau blok berikutnya
       [YOGA]                 penanda pembicara untuk paragraf berikutnya
       > Yoga: ketuk ...      baris aksi/demo (tidak diucapkan)
       ??? Pertanyaan         tanya jawab yang bisa dilipat
       - butir daftar         | sel | sel |  tabel      ! kotak penting      **tebal**
       >[ANGEL] klik tombol   baris aksi untuk orang tertentu       ~ muncul angka   baris kecil "tekan spasi"
       %% Kategori            kategori tanya jawab (jadi tombol saring di atas)
       @gambar <id> 1280x720 | keterangan    gambar anggota-saja dari /api/img (|| = tanpa keterangan) */
  function inlineMd(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function spkClass(n) { n = String(n || "").toUpperCase(); return n === "ANGEL" ? "a" : (n === "YOGA" ? "y" : "o"); }
  function parseNote(body) {
    var out = [], toc = [], open = null, list = false, table = null, box = false, chip = "", n = 0, qs = 0;
    var who = "", cats = [], cat = -1, qIdx = -1, spk = {}, imgs = [];
    function dw(w) { return w === "a" || w === "y" ? ' data-w="' + w + '"' : ""; }
    function tagged(s) { var x = s.match(/^\[([^\]]+)\]\s*(.*)$/); return x ? { who: x[1], w: spkClass(x[1]), t: x[2] } : { who: "", w: "", t: s }; }
    function closeList() { if (list) { out.push("</ul>"); list = false; } if (table) { out.push(table + "</table></div>"); table = null; } if (box) { out.push("</div>"); box = false; } }
    function closeBlock() { closeList(); if (open) { out.push(open === "q" ? "</div></details>" : "</div>"); open = null; } who = ""; qIdx = -1; }
    String(body || "").split("\n").forEach(function (raw) {
      var l = raw.replace(/\s+$/, ""), m, g;
      if (!l.trim()) { closeList(); return; }
      if ((m = l.match(/^##\s+(.*)/))) { closeBlock(); var id = "c" + (++n); toc.push({ id: id, t: m[1] }); out.push('<h3 class="nt-h" id="' + id + '">' + inlineMd(m[1]) + "</h3>"); return; }
      if ((m = l.match(/^#\s+(.*)/))) { closeBlock(); out.push('<h2 class="nt-title disp">' + inlineMd(m[1]) + "</h2>"); return; }
      if ((m = l.match(/^===\s*(.*)/))) { closeBlock(); out.push('<div class="nt-babak ' + spkClass(m[1].split(/\s/)[1]) + '">' + inlineMd(m[1]) + "</div>"); return; }
      if (l.trim() === "---") { closeBlock(); return; }
      if ((m = l.match(/^%%\s*(.+)/))) { closeBlock(); cat = cats.length; cats.push({ t: m[1], n: 0 }); out.push('<h4 class="nt-kat">' + inlineMd(m[1]) + "</h4>"); return; }
      if ((m = l.match(/^@gambar\s+([a-f0-9]{16,64})(?:\s+(\d{1,5})x(\d{1,5}))?\s*(?:\|(\|)?\s*(.*))?$/))) {
        closeList();
        var cap = m[5] || "";
        out.push('<figure class="nt-img"' + dw(who) + '><button type="button" class="nt-img-b" data-zoom="' + m[1] + '" aria-label="' + T("Perbesar gambar") + (cap ? ": " + esc(cap) : "") + '"><img data-ni="' + m[1] + '" src="/api/img?id=' + m[1] + '" alt="' + esc(cap) + '" loading="lazy" decoding="async"' + (m[2] && m[3] ? ' width="' + m[2] + '" height="' + m[3] + '"' : "") + "></button>" + (cap && !m[4] ? "<figcaption>" + inlineMd(cap) + "</figcaption>" : "") + "</figure>");
        imgs.push(m[1]); return;
      }
      if ((m = l.match(/^\[([^\]]+)\]\s*(.*)$/))) {
        if (!m[2]) {
          if (open === "q" && qIdx >= 0) { out[qIdx] = out[qIdx].replace("</span></summary>", '</span><span class="nt-chip ' + spkClass(m[1]) + '">' + esc(m[1]) + "</span></summary>"); qIdx = -1; return; }
          chip = m[1]; return;
        }
        closeBlock(); var p = m[2].split(" | "), id2 = "c" + (++n);
        who = spkClass(m[1]); spk[who] = 1;
        toc.push({ id: id2, t: p[0], who: m[1] });
        out.push('<div class="nt-spk ' + who + '" id="' + id2 + '"><div class="nt-kepala"><span><b class="nt-who">' + esc(m[1]) + "</b>" + inlineMd(p[0]) + "</span>" + (p[1] ? '<span class="mono">' + esc(p[1]) + "</span>" : "") + "</div>");
        open = "spk"; return;
      }
      if ((m = l.match(/^\?\?\?\s*(.*)/))) { closeBlock(); qs++; if (cat >= 0) cats[cat].n++; out.push('<details class="nt-q"' + (cat >= 0 ? ' data-k="' + cat + '"' : "") + '><summary><span class="nt-qt">' + inlineMd(m[1]) + '</span></summary><div class="nt-a">'); qIdx = out.length - 1; open = "q"; return; }
      if ((m = l.match(/^>\s?(.*)/))) { closeList(); g = tagged(m[1]); out.push('<p class="nt-aksi' + (g.w ? " " + g.w : "") + '"' + dw(g.w) + "><span>" + T("AKSI") + (g.who ? " · " + esc(g.who.toUpperCase()) : "") + "</span>" + inlineMd(g.t) + "</p>"); qIdx = -1; return; }
      if ((m = l.match(/^~(?=\s|\[)\s?(.*)/))) { closeList(); g = tagged(m[1]); var kw = g.w || who; out.push('<p class="nt-klik' + (kw ? " " + kw : "") + '"' + dw(kw) + "><span>" + T("SPASI") + "</span>" + inlineMd(g.t) + "</p>"); return; }
      if ((m = l.match(/^!\s?(.*)/))) { if (list || table) closeList(); if (!box) { out.push('<div class="nt-box"' + dw(who) + ">"); box = true; } out.push("<p>" + inlineMd(m[1]) + "</p>"); return; }
      if ((m = l.match(/^-\s+(.*)/))) { if (box || table) closeList(); if (!list) { out.push("<ul" + dw(who) + ">"); list = true; } out.push("<li>" + inlineMd(m[1]) + "</li>"); return; }
      if (/^\|.*\|$/.test(l.trim())) {
        if (list || box) closeList();
        var cells = l.trim().slice(1, -1).split("|").map(function (c) { return c.trim(); });
        if (!table) { table = '<div class="tw"' + dw(who) + '><table class="nt-t"><tr>' + cells.map(function (c) { return "<th>" + inlineMd(c) + "</th>"; }).join("") + "</tr>"; return; }
        table += "<tr>" + cells.map(function (c) { return "<td>" + inlineMd(c) + "</td>"; }).join("") + "</tr>"; return;
      }
      closeList();
      var pw = chip ? spkClass(chip) : who;
      out.push("<p" + dw(pw) + ">" + (chip ? '<span class="nt-chip ' + spkClass(chip) + '">' + esc(chip) + "</span>" : "") + inlineMd(l) + "</p>"); chip = ""; qIdx = -1;
    });
    closeBlock();
    return { html: out.join(""), toc: toc, qs: qs, cats: cats, spk: spk, imgs: imgs };
  }
  function noteSnippet(b) { var l = String(b || "").split("\n").filter(function (x) { return x.trim() && !/^(#|===|---|\||!|\[|@gambar|%%|~)/.test(x.trim()) && x.trim() !== x.trim().toUpperCase(); })[0] || ""; return l.replace(/^(\?\?\?|>|-|\[[^\]]+\])\s*/, "").replace(/^\[[^\]]+\]\s*/, "").replace(/\*\*/g, "").slice(0, 110); }
  function renderNotes(t) {
    var ns = (t.notes || []).slice().sort(function (a, b) { return a.sort - b.sort; });
    var html = tabHero("buku", T("Catatan perjalanan"), T("Naskah, daftar periksa, dan tanya jawab. Bisa dibaca saat sinyal hilang setelah pernah dibuka.")) +
      (ns.length ? '<div class="nt-list">' + ns.map(function (n, i) { return '<a class="nt-card" href="#/t/' + t.id + "/catatan/" + n.id + '"><span class="nt-no mono">' + (i + 1 < 10 ? "0" : "") + (i + 1) + '</span><span class="nt-mid"><b>' + esc(n.title) + "</b><small>" + esc(noteSnippet(n.body)) + "</small>" + (byLine(n) ? '<em>' + esc(byLine(n)) + "</em>" : "") + "</span></a>"; }).join("") + "</div>"
        : emptyArt("buku", T("Belum ada catatan. Simpan naskah presentasi, daftar barang bawaan, atau catatan rapat di sini."), '<button class="btn pri" id="nf">' + ic("plus") + T("Tulis catatan") + "</button>"));
    shell(t, "catatan", html, T("Catatan§fab"));
    document.getElementById("fab").onclick = function () { noteSheet(null); };
    var nf = document.getElementById("nf"); if (nf) nf.onclick = function () { noteSheet(null); };
    warmImages(t.notes);
  }
  function noteView(n, opts) {
    var r = parseNote(n.body), fil = "";
    if (r.spk.a && r.spk.y) fil = '<div class="nt-fil" role="group" aria-label="' + T("Saring menurut pembicara") + '">' + [["", T("Semua")], ["a", "Angel"], ["y", "Yoga"]].map(function (x, i) { return '<button type="button" class="chip' + (x[0] ? " " + x[0] : "") + (i ? "" : " on") + '" data-fw="' + x[0] + '" aria-pressed="' + (i ? "false" : "true") + '">' + x[1] + "</button>"; }).join("") + "</div>";
    else if (r.cats.length > 1) fil = '<div class="nt-fil" role="group" aria-label="' + T("Saring menurut kategori") + '"><button type="button" class="chip on" data-fk="" aria-pressed="true">' + T("Semua") + "<i>" + r.qs + "</i></button>" + r.cats.map(function (c, i) { return '<button type="button" class="chip" data-fk="' + i + '" aria-pressed="false">' + esc(c.t) + "<i>" + c.n + "</i></button>"; }).join("") + "</div>";
    var toc = r.toc.length > 1 ? '<nav class="nt-toc" aria-label="' + T("Daftar isi") + '">' + r.toc.map(function (x) { return '<a href="#' + x.id + '" data-toc="' + x.id + '"' + (x.who ? ' class="' + spkClass(x.who) + '"' : "") + ">" + esc(x.t.replace(/^SLIDE\s+/i, "Slide ")) + "</a>"; }).join("") + "</nav>" : "";
    return '<article class="nt-doc' + (fil && toc ? " dua" : "") + '">' + '<h1 class="nt-h1 disp">' + esc(n.title) + "</h1>" +
      (fil || toc ? '<div class="nt-bar">' + fil + toc + "</div>" : "") +
      (r.qs ? '<div class="btns" style="margin:0 0 12px"><button class="btn sm" id="qAll">' + T("Buka semua jawaban") + '</button></div>' : "") +
      r.html + "</article>";
  }
  /* saring naskah menurut pembicara: yang tampil adalah ucapan dan tugas orang itu */
  function setWho(doc, w) {
    if (w) doc.dataset.f = w; else delete doc.dataset.f;
    doc.querySelectorAll("[data-fw]").forEach(function (b) { var on = b.dataset.fw === w; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    doc.querySelectorAll(".nt-spk").forEach(function (blk) {
      var keep = !w || Array.prototype.some.call(blk.children, function (c) { return !c.classList.contains("nt-kepala") && (!c.dataset.w || c.dataset.w === w); });
      blk.hidden = !keep;
      var a = doc.querySelector('[data-toc="' + blk.id + '"]'); if (a) a.hidden = !keep;
    });
  }
  function setCat(doc, k) {
    doc.querySelectorAll("[data-fk]").forEach(function (b) { var on = b.dataset.fk === k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    doc.querySelectorAll(".nt-kat").forEach(function (h) { h.hidden = k !== ""; });
    doc.querySelectorAll("details.nt-q").forEach(function (d) { d.hidden = k !== "" && d.dataset.k !== k; });
  }
  /* gambar catatan: hanya untuk anggota (lewat /api/img); salinannya disimpan service worker untuk dibaca luring */
  function imgGone(im) {
    var f = im.closest(".nt-img"); if (!f || f.classList.contains("x")) return;
    var b = f.querySelector(".nt-img-b"); f.classList.add("x"); b.disabled = true;
    b.innerHTML = '<span class="nt-img-x">' + ic("img") + (navigator.onLine === false ? T("Gambar ini belum tersimpan di HP. Buka catatan ini sekali saat ada sinyal.") : T("Gambar belum bisa dimuat. Periksa sinyal, lalu buka lagi catatan ini.")) + "</span>";
  }
  var warmed = {};
  function warmImages(notes) {
    try {
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller || navigator.onLine === false || (navigator.connection && navigator.connection.saveData)) return;
      var ids = [];
      (notes || []).forEach(function (n) { String(n.body || "").replace(/^@gambar\s+([a-f0-9]{16,64})/gm, function (x, id) { if (!warmed[id]) { warmed[id] = 1; ids.push(id); } return x; }); });
      (function next() { var id = ids.shift(); if (!id) return; fetch("/api/img?id=" + id, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).catch(function () { delete warmed[id]; }).then(function () { setTimeout(next, 120); }); })();
    } catch (e) {}
  }
  function closeZoom(fromPop) {
    var z = document.getElementById("ntz"); if (!z) return;
    z.remove(); document.body.style.overflow = "";
    if (!fromPop && history.state && history.state.ntz) history.back();
  }
  function zoomImg(id, alt) {
    closeZoom(true);
    var z = document.createElement("div"); z.className = "nt-zoom"; z.id = "ntz"; z.dataset.lv = "0";
    z.setAttribute("role", "dialog"); z.setAttribute("aria-modal", "true"); z.setAttribute("aria-label", T("Gambar diperbesar"));
    z.innerHTML = '<div class="nt-zoom-s"><img src="/api/img?id=' + id + '" alt="' + esc(alt) + '"></div><div class="nt-zoom-bar"><button type="button" class="btn sm" id="ntzt">' + T("Perbesar") + '</button><button type="button" class="btn sm pri" id="ntzx">' + T("Tutup") + "</button></div>";
    document.body.appendChild(z); document.body.style.overflow = "hidden";
    try { history.pushState({ ntz: 1 }, ""); } catch (e) {}
    var lv = 0, bt = z.querySelector("#ntzt");
    function tog() { lv = (lv + 1) % 3; z.dataset.lv = String(lv); bt.textContent = lv === 2 ? T("Kecilkan") : T("Perbesar"); }
    z.querySelector("img").onclick = tog; bt.onclick = tog;
    z.querySelector("#ntzx").onclick = function () { closeZoom(); };
    z.querySelector("#ntzx").focus();
  }
  window.addEventListener("popstate", function () { closeZoom(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeZoom(); });
  function bindNoteView(root) {
    var doc = root.querySelector(".nt-doc");
    root.querySelectorAll("[data-toc]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var el = document.getElementById(a.dataset.toc); if (el) el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }; });
    var qa = root.querySelector("#qAll");
    if (qa) qa.onclick = function () { var ds = root.querySelectorAll("details.nt-q:not([hidden])"), anyClosed = Array.prototype.some.call(ds, function (d) { return !d.open; }); ds.forEach(function (d) { d.open = anyClosed; }); qa.textContent = anyClosed ? T("Tutup semua jawaban") : T("Buka semua jawaban"); };
    if (!doc) return;
    root.querySelectorAll("[data-fw]").forEach(function (b) { b.onclick = function () { setWho(doc, b.dataset.fw); }; });
    root.querySelectorAll("[data-fk]").forEach(function (b) { b.onclick = function () { setCat(doc, b.dataset.fk); }; });
    root.querySelectorAll("img[data-ni]").forEach(function (im) { im.onerror = function () { imgGone(im); }; });
    root.querySelectorAll("[data-zoom]").forEach(function (b) { b.onclick = function () { var im = b.querySelector("img"); if (im) zoomImg(b.dataset.zoom, im.alt); }; });
  }
  function renderNote(t, id) {
    var n = (t.notes || []).find(function (x) { return x.id === id; });
    if (!n) { location.hash = "#/t/" + t.id + "/catatan"; return; }
    var html = '<a class="link-back" href="#/t/' + t.id + '/catatan">' + ic("back", ' width="16" height="16"') + T("Semua catatan") + "</a>" + noteView(n) +
      '<div class="btns" style="margin-top:22px"><button class="btn" id="ne">' + T("Ubah catatan") + "</button></div>" + (byLine(n) ? '<p class="hint" style="margin-top:10px">' + T("Catatan ini {by}.", { by: esc(byLine(n)) }) + "</p>" : "");
    shell(t, "catatan", html, "");
    bindNoteView($app);
    document.getElementById("ne").onclick = function () { noteSheet(n); };
    warmImages(t.notes);
  }
  function noteSheet(n) {
    var t = S.trip, isNew = !n;
    n = n || { title: "", body: "", sort: (t.notes || []).length };
    var c = openSheet("<h2>" + (isNew ? T("Catatan baru") : T("Ubah catatan")) + '</h2><form id="nfm">' +
      '<div class="f"><label for="ntt">' + T("Judul") + '</label><input class="in-t" id="ntt" required placeholder="' + T("Contoh: Naskah presentasi") + '"></div>' +
      '<div class="f"><label for="ntb">' + T("Isi") + '</label><textarea class="in-t nt-edit" id="ntb" rows="14" placeholder="' + T("Tulis di sini. Lihat cara memformat di bawah.") + '"></textarea></div>' +
      '<details class="more"><summary>' + T("Cara memformat") + '</summary><div class="hint nt-help">' +
      T("<p><b>## Subjudul</b>: masuk daftar isi.</p><p><b>[ANGEL] Slide 1 | 0.15</b>: blok bicara Angel dengan durasi; tutup dengan <b>---</b>.</p><p><b>&gt; Yoga: ketuk tombol</b>: baris aksi demo, tidak diucapkan.</p>") +
      T("<p><b>&gt;[ANGEL] klik tombol</b>: aksi untuk orang tertentu. <b>~ teks</b>: baris kecil tekan spasi.</p><p><b>??? Pertanyaan</b>: tanya jawab yang bisa dilipat; baris <b>[YOGA]</b> menandai penjawab, baris <b>%% Kategori</b> membuat tombol kategori.</p><p><b>- butir</b>, <b>| sel | sel |</b> untuk tabel, <b>! teks</b> untuk kotak penting, <b>**tebal**</b>.</p>") + "</div></details>" +
      '<div class="err" id="nte"></div><div class="save-bar"><button class="btn pri block" type="submit">' + T("Simpan catatan") + "</button></div>" +
      (!isNew && canDel(n) ? '<button type="button" class="btn danger block" id="ntd" style="margin-top:10px">' + T("Hapus catatan") + "</button>" : "") + "</form>");
    c.querySelector("#ntt").value = n.title; c.querySelector("#ntb").value = n.body;
    c.querySelector("#nfm").onsubmit = async function (ev) {
      ev.preventDefault();
      var body = { title: c.querySelector("#ntt").value.trim(), body: c.querySelector("#ntb").value };
      if (!body.title) { c.querySelector("#nte").textContent = T("Judul belum diisi."); return; }
      ev.target.querySelector("button[type=submit]").disabled = true;
      try {
        if (isNew) { body.trip_id = t.id; body.sort = n.sort; var j = await api("/api/items?t=notes", { method: "POST", body: body }); t.notes = (t.notes || []).concat(j.item); saveOffline(t); closeSheet(); location.hash = "#/t/" + t.id + "/catatan/" + j.item.id; }
        else { var j2 = await api("/api/items?t=notes&id=" + n.id, { method: "PATCH", body: body }); Object.assign(n, j2.item); saveOffline(t); closeSheet(); renderNote(t, n.id); }
        toast(T("Catatan tersimpan"));
      } catch (x) { c.querySelector("#nte").textContent = T("Gagal menyimpan. Periksa sinyal, lalu coba lagi."); ev.target.querySelector("button[type=submit]").disabled = false; }
    };
    if (c.querySelector("#ntd")) c.querySelector("#ntd").onclick = async function () {
      if (!confirm(T('Hapus catatan "{t}"?', { t: n.title }))) return;
      await api("/api/items?t=notes&id=" + n.id, { method: "DELETE" });
      t.notes = t.notes.filter(function (x) { return x.id !== n.id; }); saveOffline(t); closeSheet(); location.hash = "#/t/" + t.id + "/catatan";
    };
  }

  /* ---------- baca luring: catatan disalin ke penyimpanan HP (baca saja) ---------- */
  var OFF = "jejak-luring";
  function offRead() { try { return JSON.parse(localStorage.getItem(OFF) || "{}"); } catch (e) { return {}; } }
  function saveOffline(t) {
    try {
      var all = offRead();
      if (!(t.notes || []).length) { delete all[t.id]; }
      else all[t.id] = { title: t.title, at: new Date().toISOString(), notes: t.notes.slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (n) { return { id: n.id, title: n.title, body: n.body }; }) };
      localStorage.setItem(OFF, JSON.stringify(all));
    } catch (e) {}
  }
  function offClear() { try { localStorage.removeItem(OFF); } catch (e) {} try { if (window.caches) caches.delete("jejak-gambar-v1"); } catch (e) {} }
  function renderOffline(noteKey) {
    var all = offRead(), keys = Object.keys(all);
    var bar = '<div class="off-bar">' + T("Mode luring. Catatan di bawah ini salinan terakhir dan hanya bisa dibaca.") + ' <button class="link-btn" onclick="location.reload()">' + T("Coba sambung lagi") + "</button></div>";
    if (noteKey) {
      var p = noteKey.split("/"), tr = all[p[0]], n = tr && tr.notes.find(function (x) { return x.id === p[1]; });
      if (n) { $app.innerHTML = '<div class="wrap">' + bar + '<a class="link-back" href="#" id="offBack">' + ic("back", ' width="16" height="16"') + T("Semua catatan") + "</a>" + noteView(n) + "</div>"; bindNoteView($app); document.getElementById("offBack").onclick = function (e) { e.preventDefault(); renderOffline(); }; window.scrollTo(0, 0); return; }
    }
    $app.innerHTML = '<div class="wrap">' + bar + keys.map(function (k) {
      var tr = all[k];
      return '<div class="sec">' + esc(tr.title) + '</div><div class="nt-list">' + tr.notes.map(function (n, i) { return '<a class="nt-card" href="#" data-off="' + esc(k + "/" + n.id) + '"><span class="nt-no mono">' + (i + 1 < 10 ? "0" : "") + (i + 1) + '</span><span class="nt-mid"><b>' + esc(n.title) + "</b><small>" + esc(noteSnippet(n.body)) + "</small></span></a>"; }).join("") + "</div>";
    }).join("") + "</div>";
    $app.querySelectorAll("[data-off]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); renderOffline(a.dataset.off); }; });
  }

  /* ---------- LAPORAN ---------- */
  function csv(t) {
    var rows = [["No", "Tanggal", "Jenis", "Kategori", "Keterangan", "Status", "Nominal", "Jumlah bukti", "Tautan bukti", "Catatan§f"].map(function (h) { return T(h); })];
    t.entries.forEach(function (e, i) { rows.push([i + 1, e.date || "", e.kind === "in" ? T("Masuk§csv") : T("Keluar"), catName(e.category), e.title, e.kind === "in" ? T("Diterima") : (e.status === "plan" ? T("Rencana") : T("Dibayar")), e.amount, (e.proofs || []).length, (e.proofs || []).map(function (p) { return p.url; }).join(" "), e.note || ""]); });
    var tot = totals(t);
    rows.push([]); rows.push(["", "", "", "", T("Total dana masuk"), "", tot.in]); rows.push(["", "", "", "", T("Total sudah dibayar"), "", tot.paid]); rows.push(["", "", "", "", T("Sisa dana"), "", tot.left]);
    return "﻿" + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? "" : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
  }
  function renderLapor(t) {
    var tot = totals(t), paidOut = t.entries.filter(function (e) { return e.kind === "out" && e.status === "paid"; });
    var proofs = t.entries.reduce(function (a, e) { return a + (e.proofs || []).length; }, 0);
    var html = tabHero("struk", T("Laporan pertanggungjawaban"), T("Rekap transaksi dengan foto bukti sebagai lampiran.")) + '<p class="muted" style="font-size:14px;line-height:1.55;margin:0 0 14px">' + T("Laporan berisi rekap transaksi dan semua foto bukti sebagai lampiran. Buka laporan, lalu pilih <b>Simpan sebagai PDF</b> pada menu cetak. Format CSV dapat dibuka di Excel.") + "</p>" +
      '<div class="cats"><div class="cat-row"><span>' + T("Dana masuk") + '</span><span></span><b class="mono">' + rp(tot.in) + '</b></div><div class="cat-row"><span>' + T("Sudah dibayar") + '</span><span></span><b class="mono">' + rp(tot.paid) + '</b></div><div class="cat-row"><span>' + T("Sisa dana") + '</span><span></span><b class="mono">' + rp(tot.left) + '</b></div><div class="cat-row"><span>' + T("Foto bukti§pl") + '</span><span></span><b class="mono">' + proofs + "</b></div></div>" +
      '<div class="btns" style="margin-top:14px"><a class="btn pri" href="#/lapor/' + t.id + '">' + ic("doc") + T("Buka laporan PDF") + '</a><button class="btn" id="csv">' + ic("dl") + T("Unduh CSV") + "</button></div>";
    if (tot.noProof.length) html += '<div class="sec">' + T("Belum ada foto bukti") + '<span class="act mono">' + tot.noProof.length + "</span></div><p class=\"hint\" style=\"margin:-4px 0 10px\">" + T("Ketuk transaksi untuk melampirkan foto.") + "</p><div class=\"list\">" + tot.noProof.map(entryRow).join("") + "</div>";
    else if (paidOut.length) html += '<div class="note-card" style="margin-top:16px">' + T("Semua pengeluaran yang sudah dibayar memiliki foto bukti. Laporan siap diserahkan.") + "</div>";
    var unconf = t.entries.filter(function (e) { return e.flag; });
    if (unconf.length) html += '<div class="sec">' + T("Perlu dicek") + '</div><div class="list">' + unconf.map(entryRow).join("") + "</div>";
    shell(t, "lapor", html, "");
    document.getElementById("csv").onclick = function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(t)], { type: "text/csv;charset=utf-8" }));
      a.download = T("Laporan {t}", { t: t.title.replace(/[^\w\s-]/g, "") }) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    };
    $app.querySelectorAll("[data-e]").forEach(function (b) { b.onclick = function () { entrySheet(t.entries.find(function (e) { return e.id === b.dataset.e; })); }; });
  }
  function renderReport(t) {
    var tot = totals(t), ins = t.entries.filter(function (e) { return e.kind === "in"; }), paid = t.entries.filter(function (e) { return e.kind === "out" && e.status === "paid"; }), plan = t.entries.filter(function (e) { return e.kind === "out" && e.status === "plan"; });
    var n = 0, att = [];
    function rows(list) { return list.map(function (e) {
      var refs = (e.proofs || []).map(function (p) { att.push({ e: e, p: p }); return "L" + att.length; }).join(", ");
      return "<tr><td>" + (++n) + "</td><td>" + esc(e.date ? fmtDay(e.date, { day: "numeric", month: "short", year: "numeric" }) : "-") + "</td><td>" + esc(e.title) + (e.note ? '<br><span style="color:#666">' + esc(e.note) + "</span>" : "") + "</td><td>" + esc(catName(e.category)) + '</td><td class="n">' + rp(e.amount) + "</td><td>" + (refs || (e.kind === "in" ? "-" : '<span style="color:#b00">' + T("belum ada") + "</span>")) + "</td></tr>";
    }).join(""); }
    var head = "<tr>" + ["No.", "Tanggal", "Uraian", "Kategori", "Nominal", "Bukti"].map(function (h) { return "<th>" + T(h) + "</th>"; }).join("") + "</tr>";
    var body = "<h1>" + T("Laporan Penggunaan Dana") + '</h1><div class="meta"><b>' + esc(t.title) + "</b><br>" + T("{a} s.d. {b}", { a: esc(fmtDay(t.start_date, { day: "numeric", month: "long", year: "numeric" })), b: esc(fmtDay(t.end_date, { day: "numeric", month: "long", year: "numeric" })) }) + (t.place ? " · " + esc(t.place) : "") + "<br>" + T("Disusun oleh: ") + esc((S.me && S.me.name) || "") + "</div>" +
      '<div class="sum"><div>' + T("Dana diterima") + "<b>" + rp(tot.in) + "</b></div><div>" + T("Total pengeluaran") + "<b>" + rp(tot.paid) + "</b></div><div>" + T("Sisa dana") + "<b>" + rp(tot.left) + "</b></div></div>" +
      "<h2>" + T("A. Dana diterima") + '</h2><div class="tw"><table>' + head + rows(ins) + '<tr><td colspan="4"><b>' + T("Jumlah") + '</b></td><td class="n"><b>' + rp(tot.in) + "</b></td><td></td></tr></table></div>" +
      "<h2>" + T("B. Pengeluaran") + '</h2><div class="tw"><table>' + head + rows(paid) + '<tr><td colspan="4"><b>' + T("Jumlah") + '</b></td><td class="n"><b>' + rp(tot.paid) + "</b></td><td></td></tr></table></div>" +
      (plan.length ? "<h2>" + T("C. Rencana yang belum dibayar") + '</h2><div class="tw"><table>' + head + rows(plan) + '<tr><td colspan="4"><b>' + T("Jumlah") + '</b></td><td class="n"><b>' + rp(tot.plan) + "</b></td><td></td></tr></table></div>" : "") +
      '<div class="sign"><div>' + esc(fmtDay(todayWIB(), { day: "numeric", month: "long", year: "numeric" })) + "<br><br><br><br>( " + esc((S.me && S.me.name) || "....................") + " )</div></div>" +
      (att.length ? '<h2 style="break-before:page;page-break-before:always">' + T("Lampiran bukti") + "</h2>" + att.map(function (a, i) { return '<div class="att"><p><b>L' + (i + 1) + "</b> · " + esc(a.e.title) + " · " + rp(a.e.amount) + (a.e.date ? " · " + esc(fmtDay(a.e.date, { day: "numeric", month: "short", year: "numeric" })) : "") + '</p><img src="' + esc(a.p.url) + '" alt="' + T("Lampiran L{n}", { n: i + 1 }) + '"></div>'; }).join("") : "");
    $app.innerHTML = '<div class="report"><div class="r-bar"><a class="link-back" style="color:#fff;margin:0" href="#/t/' + t.id + '/lapor">' + ic("back", ' width="18" height="18"') + T("Kembali") + '</a><span class="sp"></span><button class="btn pri sm" id="pr">' + ic("print") + T("Cetak atau simpan PDF") + '</button></div><div class="doc">' + body + "</div></div>";
    document.getElementById("pr").onclick = function () { window.print(); };
    document.title = T("Laporan {t}", { t: t.title });
  }

  /* ---------- router ---------- */
  async function route() {
    if (!S.me) return renderAuth();
    closeSheet(); closeZoom(true);
    document.title = BRAND;
    var h = location.hash.replace(/^#\/?/, "").split("/");
    try {
      if (h[0] === "t" && h[1]) {
        if (!S.trip || S.trip.id !== h[1]) { $app.innerHTML = '<div class="boot">' + T("Memuat…") + "</div>"; await loadTrip(h[1]); }
        var t = S.trip, tab = h[2] || "dana";
        if (tab === "rundown") renderRundown(t);
        else if (tab === "diari" && h[3]) renderDay(t, h[3]);
        else if (tab === "diari") renderDiari(t);
        else if (tab === "lapor") renderLapor(t);
        else if (tab === "catatan" && h[3]) renderNote(t, h[3]);
        else if (tab === "catatan") renderNotes(t);
        else renderDana(t);
        if (!h[3]) window.scrollTo(0, 0);
        return;
      }
      if (h[0] === "lapor" && h[1]) { if (!S.trip || S.trip.id !== h[1]) await loadTrip(h[1]); renderReport(S.trip); window.scrollTo(0, 0); return; }
      S.trip = null; await renderHome();
    } catch (e) {
      if (e.message === "unauthorized") return;
      $app.innerHTML = '<div class="wrap"><div class="empty">' + (e.status === 404 ? T("Perjalanan tidak ditemukan.") : T("Data belum bisa dimuat. Periksa sinyal, lalu coba lagi.")) + '<br><br><a class="btn" href="#/">' + T("Kembali") + '</a> <button class="btn" onclick="location.reload()">' + T("Muat ulang") + "</button></div></div>";
    }
  }
  window.addEventListener("hashchange", route);

  async function boot() {
    try { S.me = await api("/api/auth"); } catch (e) {
      S.me = null;
      if (e.status !== 401) {                  // gangguan server/sinyal: jangan tampilkan layar masuk
        if (Object.keys(offRead()).length) { renderOffline(); return; }
        $app.innerHTML = '<div class="wrap"><div class="empty">' + T("Koneksi ke server gagal. Periksa sinyal, lalu coba lagi.") + '<br><br><button class="btn pri" onclick="location.reload()">' + T("Muat ulang") + "</button></div></div>";
        return;
      }
    }
    if (!S.me) { renderAuth(/daftar|signup/.test(location.search) ? "signup" : "login"); return; }
    try { S.ai = !!(await api("/api/ai")).enabled; } catch (e) {}
    if (!location.hash || location.hash === "#/") {
      try { var j = await api("/api/trips"); var today = todayWIB(); var cur = j.trips.find(function (t) { return t.start_date <= today && t.end_date >= today; }) || (j.trips.length === 1 ? j.trips[0] : null); if (cur) history.replaceState(null, "", "#/t/" + cur.id + "/dana"); } catch (e) {}
    }
    route();
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(function (r) { r.update(); }).catch(function () {});
  boot();
})();
