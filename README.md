# Sangu

Catatan dana perjalanan dinas & lomba: pemasukan, pengeluaran per kategori (rencana vs sudah dibayar), foto bukti struk, rundown yang bisa diedit, diari foto per hari, dan laporan pertanggungjawaban (PDF lewat cetak browser + CSV).

- Statis: `landing/` (halaman depan `/`), `web/` (app `/app`)
- API (Vercel Functions): `api/auth`, `api/trips`, `api/items`, `api/upload`, `api/ai`
- Data: Neon Postgres (`@vercel/postgres`), foto di Vercel Blob
- AI opsional: `GEMINI_API_KEY` atau `ANTHROPIC_API_KEY` (scan struk + saran anggaran)

Isi awal akun Angel: `node --env-file=.env.local scripts/seed-angel.js` (kode undangan ditulis ke `rahasia/`, tidak masuk git).
