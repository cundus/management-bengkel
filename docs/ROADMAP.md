# Roadmap WMC 225

Roadmap ini disusun dari masalah operasional bengkel → alur data → fitur → verifikasi. Status per **9 November 2026**.

## Ringkasan status

| Fase | Fokus | Status | Bukti |
| --- | --- | --- | --- |
| 0 | Riset & framing masalah | ✅ Selesai | `docs/RESEARCH.md` |
| 1 | Fondasi data, auth, desain mobile-first | ✅ Selesai | Schema 10 tabel, login 2 role, design system |
| 2 | Transaksi, nota, stok, pembayaran | ✅ Selesai | Nota atomik, stok otomatis, cicilan pembayaran |
| 3 | Piutang, hutang, laporan, ekspor | ✅ Selesai | Aging piutang, AP supplier, laba rugi & CSV |
| 4 | PWA, QA, dokumentasi | ✅ Selesai | 22 unit tests, 6 E2E tests, build sukses |
| 5 | PostgreSQL + Prisma & Vercel readiness | ✅ Selesai | Schema + migration, seed PostgreSQL, deploy guide |

**Rilis saat ini: v1.1 — MVP operasional single-outlet, siap Vercel + PostgreSQL.**

---

## Fase 0 — Riset & framing (selesai)

**Tujuan:** memastikan masalah yang dibangun benar-benar masalah bengkel, bukan asumsi.

Kegiatan:
- Mencari proyek bengkel dan boilerplate relevan di GitHub (lihat `docs/RESEARCH.md`).
- Memetakan tiga masalah utama menjadi kebutuhan data:
  1. *hutang-piutang tidak tertracking* → entitas piutang turunan nota + pembayaran + jatuh tempo;
  2. *pendapatan tidak rapi* → pemisahan omset vs kas diterima vs laba;
  3. *transaksi tidak sistematis* → nota, item snapshot, nomor invoice, jejak pembuat.
- Menetapkan non-goals MVP: payment gateway, multi-cabang, payroll, akuntansi pajak formal.

**Exit criteria:** ruang lingkup, stack, dan model data disepakati.

## Fase 1 — Fondasi (selesai)

**Tujuan:** aplikasi bisa dijalankan, diamankan, dan punya kerangka UI konsisten.

- Next.js 16 + React 19 + TypeScript strict + Tailwind 4.
- Prisma schema + PostgreSQL migration + seed realistis 80 hari.
- Auth login/logout dengan cookie HttpOnly JWT, hash bcrypt, role owner/kasir.
- Shell aplikasi: sidebar desktop, header & bottom nav mobile, halaman login.
- Design tokens, komponen kartu, badge, form, dialog, empty state.
- PWA manifest, ikon, service worker, offline page.

**Exit criteria:** login berfungsi, route terlindungi, layout responsif di 390 px dan 1440 px.

## Fase 2 — Transaksi inti (selesai)

**Tujuan:** setiap servis bisa dicatat dalam < 60 detik di ponsel.

- Katalog jasa/sparepart dengan harga jual, modal, stok, dan stok minimum.
- Form transaksi: pelanggan → kendaraan → mekanik → item → diskon → pembayaran.
- Mode bayar **Lunas / DP / Belum**; pembayaran awal opsional.
- Nomor invoice harian berurutan (`INV-YYYYMMDD-NNN`).
- Simpan atomik: nota + item + pembayaran + pengurangan stok dalam satu transaksi database.
- Detail nota siap cetak, unduh CSV, tagih WhatsApp.
- Pembatalan nota oleh pemilik (termasuk nota berbayar dengan refund penuh/sebagian) + restore stok; kasir mengajukan, pemilik menyetujui/menolak.

**Exit criteria:** stok tidak negatif, total konsisten, pembayaran tidak bisa melebihi total, nota bisa dicetak.

## Fase 3 — Piutang, hutang, laporan (selesai)

**Tujuan:** pertanyaan “uang saya di mana?” bisa dijawab dalam < 10 detik.

Piutang:
- Daftar 19+ nota terbuka, sisa tagihan, jatuh tempo, aging 1–7/8–30/>30 hari.
- Filter jatuh tempo, pencarian, pengingat WhatsApp, pencatatan pembayaran cepat (bottom sheet).
- Status turunan: `belum_bayar → sebagian → lunas`.

Hutang:
- Supplier, referensi tagihan, jatuh tempo, pembayaran termin.
- Ringkasan kewajiban, lewat tempo, dan pembayaran bulan ini.

Laporan:
- Omset, HPP, laba kotor, biaya operasional, laba bersih.
- Kas masuk, kas keluar, arus kas bersih, piutang berjalan.
- Tren 7 hari di dashboard dan grafik harian bulanan.
- Komposisi pengeluaran, metode pembayaran, item terlaris, rincian harian.
- Ekspor CSV laporan & transaksi; proteksi formula injection.

**Exit criteria:** laporan bulan berjalan cocok dengan query database; ekspor CSV dapat dibuka di spreadsheet.

## Fase 4 — PWA & kualitas (selesai)

- Manifest installable, route shortcut, ikon any/maskable/apple, tema gelap.
- Offline fallback; service worker tidak meng-cache API/data sensitif.
- 22 unit/integration tests: kalkulasi uang, tanggal, aging, CSV injection, integritas seed.
- 6 E2E tests: login, semua modul, buat nota → bayar, customer/item/expense, void nota, role gate kasir.
- Build produksi sukses; semua halaman dinamis (auth-aware).

---

## Backlog terprioritas

Prioritas dinilai berdasarkan **dampak operasional ÷ effort**.

### P1 — sebelum dipakai bengkel sungguhan

| # | Inisiatif | Nilai | Effort | Acceptance criteria |
| --- | --- | --- | --- | --- |
| 1 | Manajemen pengguna & reset kata sandi | Keamanan operasional | M | Owner bisa undang/nonaktifkan kasir, reset password, sesi lama invalid. |
| 2 | Audit log transaksi & pembayaran | Kepercayaan data | M | Setiap create/update/void/payment tercatat aktor + waktu + before/after. |
| 3 | Koreksi pembayaran (reversal, bukan hapus) | Akuntabilitas | M | Salah input bisa dibalik dengan entri reversal; laporan tetap auditabel. |
| 4 | Backup otomatis provider + uji restore | Lindung data | S | Backup harian aktif, restore ke staging diuji dan didokumentasikan. |
| 5 | Nota PDF + kirim WhatsApp | Pengalaman pelanggan | M | PDF rapi A5/thermal, tautan/attachment WhatsApp. |
| 6 | Stock movement ledger + opname | Stok akurat | L | Semua masuk/keluar stok punya ledger; opname menghasilkan selisih. **Ledger ✅, penyesuaian manual ✅ (PS-NNNNN, masuk laba rugi), opname massal belum.** |
| 7 | Test kontrak query laporan | Cegah regresi uang | S | Snapshot angka laporan untuk dataset tetap. |

### P2 — pertumbuhan & efisiensi

| # | Inisiatif | Nilai | Effort |
| --- | --- | --- | --- |
| 8 | Purchase order → penerimaan barang → hutang otomatis | Rantai pasok rapi | L |
| 9 | Reminder jatuh tempo otomatis (WA/email) | Mempercepat collection | M |
| 10 | Appointment & status pengerjaan (antre/dikerjakan/selesai) | Pengalaman pelanggan | M |
| 11 | Portal pelanggan untuk cek riwayat & nota | Transparansi | L |
| 12 | QRIS dinamis / payment gateway | Rekonsiliasi pembayaran | L |
| 13 | Komisi mekanik & payroll sederhana | Retensi tim | M |
| 14 | Offline-first draft nota dengan sinkronisasi | Bengkel sinyal lemah | XL |

### P3 — skala & platform

| # | Inisiatif | Nilai | Effort |
| --- | --- | --- | --- |
| 15 | Multi-cabang + peran per cabang | Ekspansi | XL |
| 16 | Read replica, partition, dan optimasi query laporan | Skala & konkurensi | L |
| 17 | SaaS multi-tenant & billing | Model bisnis | XL |
| 18 | Integrasi akuntansi (jurnal, pajak) | Kepatuhan | L |
| 19 | Benchmark & insight otomatis | Keputusan pemilik | M |

---

## Rencana rilis

| Rilis | Target | Tema | Isi utama |
| --- | --- | --- | --- |
| v1.0 | Nov 2026 | Fondasi | MVP operasional single-outlet |
| v1.1 | Nov 2026 | Deploy-ready | Rebrand WMC 225, Prisma + PostgreSQL, Vercel + isolasi database test |
| v1.2 | Q1 2027 | Aman & auditabel | P1 #1–4 |
| v1.3 | Q2 2027 | Pengalaman pelanggan | Nota PDF, WA reminder, status pengerjaan |
| v1.4 | Q3 2027 | Rantai pasok | PO, stock ledger, opname |
| v2.0 | 2027+ | Skala | Multi-cabang, read replica, multi-tenant |

Target bersifat indikatif; urutan dapat berubah berdasarkan feedback bengkel pilot.

---

## Metrik keberhasilan

Produk:
- Waktu membuat nota < 60 detik di ponsel.
- ≥ 95% transaksi harian tercatat di aplikasi (bukan catatan lain).
- Piutang lewat jatuh tempo turun ≥ 30% dalam 3 bulan.
- Selisih kas harian turun menjadi < 1% omset.
- Waktu menyiapkan laporan bulanan < 5 menit (sebelumnya berjam-jam).

Teknis:
- p95 load halaman inti < 1,5 detik pada koneksi 4G.
- 0 payment melebihi total, 0 stok negatif, 0 invoice duplikat (dijaga test).
- Semua rilis lolos typecheck, build, unit, dan E2E.

## Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Database provider down / koneksi habis | Tinggi | Pooled connection, connection limit, backup provider, monitoring, dan prosedur restore. |
| Kasir salah input pembayaran | Sedang | Reversal (P1), audit log, role owner untuk void. |
| Stok fisik ≠ sistem | Sedang | Ledger & opname (P1), jadwal opname mingguan. |
| Kebocoran akses | Tinggi | Secret kuat, sesi HttpOnly, role gate, rate limit login di v1.1. |
| Adopsi rendah karena UI rumit | Tinggi | Uji ke bengkel pilot, golden path < 60 detik, pelatihan singkat. |
| Ekspektasi laporan = pajak | Sedang | Disclaimer di UI & dokumentasi; konsultasi akuntan untuk formalitas. |

## Definisi selesai (production-ready)

- [x] Build produksi tanpa error.
- [x] Typecheck strict.
- [x] Unit + E2E hijau.
- [x] Role gate untuk modul sensitif.
- [x] Ekspor CSV dan database PostgreSQL terkelola.
- [ ] Audit log & manajemen pengguna.
- [ ] Backup/restore otomatis + uji restore.
- [ ] Rate limiting login & observability.
- [x] Migrasi Prisma + PostgreSQL dan panduan Vercel.
- [ ] UAT dengan minimal 3 bengkel pilot.
