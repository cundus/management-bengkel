# Proposed Enhancement — Input Pembelian & Arus Kas

**Status:** Proposal, belum diimplementasikan  
**Tanggal review:** 17 November 2026  
**Cakupan:** alur `/pembelian/baru`, `createPurchaseAction`, tampilan arus kas, dan laporan terkait.  
**Dasar:** review kode `src/actions/purchases.ts`, `src/lib/stock.ts`, `src/lib/queries/reports.ts`, halaman pembelian/arus kas, serta test pembelian yang ada. `pnpm typecheck` lulus; test integrasi tidak dijalankan karena PostgreSQL lokal tidak aktif.

## Ringkasan perilaku saat ini

- Satu simpan pembelian membuat `Purchase` + `StockBatch` + `StockMovement` + `Payable` (+ `PayablePayment` bila DP/lunas) dalam satu transaksi database.
- Pembelian **tidak** membuat `Expense`. HPP baru muncul saat barang terjual memakai modal batch (FIFO).
- Arus kas hanya terpengaruh oleh `PayablePayment`: DP/lunas di tanggal bisnis pembelian, pelunasan berikutnya di tanggal pembayaran.
- Pembelian bersifat append-only: tidak ada edit, hapus, atau void.

## Status implementasi (17 November 2026)

Paket B (perbaikan UX + pencegahan) sudah diimplementasikan:

- **Form pembelian** menampilkan **Kas keluar saat simpan** dan **Hutang supplier bertambah**, dengan peringatan agar tidak mencatat ulang di Pengeluaran.
- **Detail pembelian** menampilkan banner sukses, kas keluar, nilai persediaan bertambah, sisa hutang, dan tautan ke Laporan Arus Kas.
- **Kategori pengeluaran "Pembelian Stok" dihapus** (diganti **Perlengkapan**) dan dialog Pengeluaran mengarahkan pembelian stok ke menu Pembelian.
- **Deteksi duplikat dua arah**: pengeluaran dengan tanggal dan nominal mendekati pembelian (dan sebaliknya) memerlukan konfirmasi eksplisit, termasuk kasus pengeluaran dicatat lebih dulu seperti yang terjadi di produksi.
- **Reversal pengeluaran**: pengeluaran salah input dikoreksi dengan entri negatif bertanggal hari ini; tidak ada hard delete.
- **Laporan arus kas**: label menjadi **Pembelian & pembayaran supplier** (termasuk pembelian tunai) dan nilai koreksi negatif tidak lagi dipotong menjadi 0.

Masih terbuka: **PE-01** (void pembelian), sisa **PE-03** (audit harian kas keluar), **PE-04–PE-16** sesuai prioritas, dan laporan pembelian/neraca di **PE-13**. **PE-02** sudah dikerjakan dengan merotasi `requestId` setelah submit sukses.

## Prioritas

| Kode | Prioritas | Arti |
| --- | --- | --- |
| P0 | Sebelum dipakai operasional | Berisiko data salah, duplikasi, atau angka kas menyesatkan. |
| P1 | Penting | Mengurangi kesalahan input dan memperjelas laporan. |
| P2 | Penyempurnaan | UX, kelengkapan audit, dan efisiensi. |

## Daftar proposal

| ID | Usulan | Prioritas | Effort | Area |
| --- | --- | --- | --- | --- |
| PE-01 | Void/koreksi pembelian yang sudah diterima | P0 | L | Domain pembelian, stok, hutang |
| PE-02 | Idempotensi `requestId` setelah submit sukses | P0 | S | Form + server action |
| PE-03 | Akurasi kas supplier dan audit harian arus kas | P0 | S | Laporan |
| PE-04 | Kebijakan modal master vs modal batch terakhir | P1 | M | Katalog + form pembelian |
| PE-05 | Normalisasi nomor nota + unique index case-insensitive | P1 | S | Pembelian, hutang, migrasi |
| PE-06 | Pemetaan error constraint ke pesan spesifik | P1 | S | Server action |
| PE-07 | Kode batch otomatis dengan opsi override | P1 | S | Form pembelian |
| PE-08 | Combobox pencarian barang + info stok/modal | P1 | M | Form pembelian |
| PE-09 | Validasi pembayaran dan jatuh tempo yang konsisten | P1 | S | Form + server |
| PE-10 | Peringatan margin dan ringkasan dampak sebelum simpan | P2 | S | Form pembelian |
| PE-11 | Deteksi duplikat lunak (supplier + total + tanggal) | P2 | S | Server action + UI |
| PE-12 | Lampiran foto nota supplier | P2 | M | Skema + storage |
| PE-13 | Laporan pembelian dan rekonsiliasi akrual–kas | P2 | M | Laporan |
| PE-14 | Konsistensi laba dashboard vs laporan | P2 | S | Dashboard |
| PE-15 | Ketahanan transaksi untuk 100 baris | P2 | M | Server action + DB |
| PE-16 | Guard perubahan belum tersimpan dan umpan balik sukses | P2 | S | Form pembelian |
| PE-17 | Pencegahan duplikasi pembelian vs pengeluaran | P0 | S | Server action + dialog pengeluaran |
| PE-18 | Reversal pengeluaran tanpa hard delete | P1 | M | Skema + action + halaman pengeluaran |

---

## P0 — Risiko data dan angka kas

### PE-01 — Void/koreksi pembelian

**Masalah.** Salah supplier, salah modal, atau salah qty tidak bisa dikoreksi. Penyesuaian stok hanya mengubah stok, sementara tagihan supplier tetap ada; tidak ada jalur untuk membatalkan dokumen pembelian.

**Bukti.** Hanya ada `createPurchaseAction` di `../src/actions/purchases.ts`; tidak ada field status/void pada model `Purchase` di `../prisma/schema.prisma`.

**Usulan.**
- Tambahkan `status` (`aktif`/`dibatalkan`), `voidedAt`, `voidedById`, `voidReason` pada `Purchase`.
- Aksi owner-only dengan aturan:
  - Belum ada pembayaran: batalkan tagihan (tanpa hard delete) dan kembalikan stok.
  - Sudah ada pembayaran: wajib reversal pembayaran terlebih dahulu, atau buat dokumen koreksi.
  - Batch yang sisa/qty-nya sudah terpakai tidak boleh dikurangi paksa; arahkan ke penyesuaian stok dengan alasan.
- Tulis `StockMovement` pembalik, jangan hapus baris ledger.
- Tampilkan tombol **Batalkan pembelian** di detail dengan konfirmasi dan alasan.

**Acceptance criteria.**
- Pembelian salah bisa dibatalkan owner tanpa hard delete.
- Saldo item, sisa batch, dan tagihan kembali konsisten.
- Tidak ada pembelian/saldo yang berubah tanpa jejak aktor + alasan.
- Test unit dan E2E untuk skenario belum dibayar, sudah DP, dan batch sudah terpakai.

### PE-02 — Idempotensi `requestId` setelah submit sukses

**Masalah.** `requestId` dibuat sekali saat halaman dirender. Bila user sukses menyimpan, menekan Back, lalu mengubah data dan menyimpan lagi, request dengan ID lama akan mengembalikan pembelian lama secara diam-diam — data baru tidak tersimpan dan user diarahkan ke dokumen lama.

**Bukti.** `randomUUID()` di `../src/app/(app)/pembelian/baru/page.tsx`; pengecekan `existing` di `../src/actions/purchases.ts`.

**Usulan.**
- Rotasi `requestId` setelah submit sukses (mis. `crypto.randomUUID()` di client) dan/atau gunakan `router.replace`.
- Simpan fingerprint payload (supplier, tanggal, total, hash baris) pada `Purchase`; bila `requestId` sama tetapi fingerprint berbeda, tolak dengan pesan “ID pengiriman ini sudah dipakai untuk pembelian lain”.
- Kembalikan pembeda `created` vs `existing` agar UI bisa menampilkan pesan yang tepat.

**Acceptance criteria.**
- Double click/submit identik tetap menghasilkan satu pembelian.
- Back → ubah data → submit tidak pernah menimpa atau salah redirect.
- Ada test untuk dua skenario tersebut.

### PE-03 — Akurasi kas supplier di laporan

**Masalah.**
1. Baris “Pembayaran hutang supplier” di laporan arus kas dihitung `Math.max(0, cashOut - expenses - refunds)`, sehingga periode yang hanya berisi entri koreksi (nominal negatif) tampil Rp 0 padahal `netCash` sudah terpengaruh.
2. Audit harian tidak menampilkan kas keluar; hari yang hanya berisi pembayaran supplier tidak muncul, dan kolom “Kas diterima” tidak memperhitungkan pembayaran supplier.

**Bukti.** `../src/app/(app)/laporan/arus-kas/page.tsx`; `../src/lib/queries/reports.ts`.

**Usulan.**
- Tampilkan `report.payableCashOut` langsung, termasuk nilai negatif berlabel “koreksi”.
- Tambahkan kolom/baris kas keluar di audit harian, dan sertakan hari yang hanya punya pembayaran supplier.
- Tambahkan rekonsiliasi singkat: pembelian periode, pembayaran atas pembelian periode ini, pembayaran hutang lama.

**Acceptance criteria.**
- Jumlah komponen kas keluar = `netCash` yang ditampilkan.
- Periode dengan hanya reversal menampilkan nilai negatif, bukan 0.
- Hari dengan hanya pembayaran supplier muncul di audit harian.

---

## P1 — Kurangi kesalahan input dan perjelas laporan

### PE-04 — Kebijakan modal master

**Masalah.** `Item.cost` tidak pernah diperbarui pembelian, tetapi form memakainya sebagai isian awal modal. Pembelian berikutnya menawarkan modal lama sehingga user berisiko menyimpan modal yang tidak sesuai.

**Bukti.** Prefill `part?.cost` di `../src/components/inventory/purchase-form.tsx`; `receiveStock` tidak menyentuh `Item.cost` di `../src/lib/stock.ts`.

**Usulan (pilih satu, perlu keputusan produk).**
- **Rekomendasi:** prefill dari batch terakhir (`StockBatch.unitCost` terbaru per item) dengan fallback `Item.cost`; tampilkan label “modal terakhir”.
- Alternatif: update `Item.cost` ke modal batch terakhir secara transaksional saat pembelian disimpan.
- Alternatif konservatif: tetap `Item.cost`, tetapi tampilkan modal terakhir di samping input dan beri label “modal acuan katalog”.

**Acceptance criteria.**
- Nilai awal modal konsisten dengan kebijakan yang dipilih.
- User bisa melihat modal terakhir sebelum menyimpan.
- Ada test untuk item dengan beberapa batch.

### PE-05 — Normalisasi nomor nota

**Masalah.** Pembelian meng-uppercase nomor nota, sedangkan tagihan manual tidak. Pengecekan duplikat di aplikasi case-insensitive, tetapi unique constraint database case-sensitive; dua request bersamaan dengan kapitalisasi berbeda bisa lolos di jalur tagihan manual. Batas panjang juga berbeda (80 vs 60).

**Bukti.** `../src/actions/purchases.ts`; `../src/actions/finance.ts`; schema `@@unique([supplierId, referenceNo])`.

**Usulan.**
- Satu fungsi `normalizeReferenceNo()` (trim + uppercase + batas panjang seragam).
- Migrasi functional unique index `lower(reference_no)` per supplier untuk `purchases` dan `payables`.
- Terapkan di semua jalur create/update.

**Acceptance criteria.**
- `inv-1` dan `INV-1` ditolak sebagai duplikat di kedua jalur.
- Dua request bersamaan tidak menghasilkan duplikat.
- Panjang maksimum konsisten di UI, action, dan dokumen.

### PE-06 — Pemetaan error constraint

**Masalah.** P2002 selain `requestId` jatuh ke pesan generik; user tidak tahu field mana yang bentrok.

**Bukti.** Catch P2002 di `../src/actions/purchases.ts`.

**Usulan.** Petakan nama constraint (`stock_batches_item_id_code_key`, `purchases_supplier_id_reference_no_key`, index referensi baru) ke pesan yang menyebut kode batch/nomor nota. Petakan juga timeout/transaksi gagal secara terpisah.

**Acceptance criteria.**
- Duplikat lot menyebut kode lot dan barangnya.
- Duplikat nota menyebut nomor nota dan supplier.
- Tidak ada pesan error database mentah yang tampil ke user.

### PE-07 — Kode batch otomatis

**Masalah.** Kode batch wajib diketik per baris; rawan salah, duplikat, dan lambat untuk pembelian banyak item.

**Usulan.** Bila kosong, server membuat kode `PB-{tanggal}-{urut}` (atau kode per baris) yang unik per item; user tetap bisa override. Validasi duplikat tetap berlaku.

**Acceptance criteria.**
- Kode batch boleh dikosongkan dan tetap tersimpan unik.
- Override manual tetap dihormati.
- Kode yang dihasilkan mudah dibaca dan dilacak ke pembelian.

### PE-08 — Combobox pencarian barang

**Masalah.** `<select>` native berisi seluruh sparepart aktif; sulit dipakai saat katalog besar dan tidak menampilkan stok/modal terkini.

**Usulan.** Combobox dengan pencarian nama/SKU, menampilkan stok saat ini, modal terakhir, dan satuan. Tetap aksesibel via keyboard dan aman di layar 390 px.

**Acceptance criteria.**
- Pencarian nama/SKU berfungsi untuk 100+ item.
- Memilih item mengisi modal sesuai kebijakan PE-04.
- Tidak ada overflow horizontal di mobile.

### PE-09 — Validasi pembayaran dan jatuh tempo

**Masalah.**
- `sebagian` dengan nominal 0 tetap diterima server sebagai tempo.
- Input jatuh tempo belum dibatasi minimal tanggal pembelian di client.
- Metode pembayaran tetap dikirim meski tempo (tidak relevan).

**Bukti.** `../src/components/inventory/purchase-form.tsx`; schema di `../src/actions/purchases.ts`.

**Usulan.**
- Server: `sebagian` wajib `0 < payNow < total`; `lunas` wajib `payNow = total`.
- Client: `min={businessDate}` pada jatuh tempo; sembunyikan/disable metode saat tempo.
- Opsional: field termin supplier (mis. 30 hari) untuk mengisi jatuh tempo otomatis.

**Acceptance criteria.**
- Kombinasi tidak valid ditolak client dan server dengan pesan jelas.
- Jatuh tempo sebelum tanggal pembelian tidak bisa dipilih.
- Tempo tidak menyimpan metode pembayaran yang menyesatkan.

---

## P2 — UX, audit, dan skala

### PE-10 — Peringatan margin dan ringkasan dampak

Tampilkan peringatan bila `unitCost >= item.price`, serta ringkasan sebelum simpan: “Stok +X, hutang +Y, kas keluar Z, laba tidak berubah”. Ini mengurangi salah paham bahwa pembelian otomatis menjadi pengeluaran. Acceptance: ringkasan cocok dengan perhitungan server dan peringatan terlihat sebelum submit.

### PE-11 — Deteksi duplikat lunak

Nomor nota opsional, sehingga pembelian yang sama bisa tercatat dua kali. Beri peringatan (bukan blokir) bila supplier + total + tanggal sama dalam ±7 hari, lengkap dengan tautan ke pembelian yang sudah ada. Acceptance: peringatan muncul dan user bisa membatalkan atau melanjutkan dengan konfirmasi.

### PE-12 — Lampiran foto nota supplier

Tambahkan relasi lampiran pada `Purchase` (tabel terpisah atau storage key), akses owner-only, batas ukuran/tipe, dan kebijakan retensi. Acceptance: unggah/pratinjau/hapus berfungsi dan file tidak dapat diakses publik tanpa otorisasi.

### PE-13 — Laporan pembelian dan rekonsiliasi

Halaman laporan pembelian per supplier/periode: nilai pembelian, batch masuk, sisa hutang, kas yang sudah dibayar, dan ekspor CSV. Acceptance: total cocok dengan query database dan tautan ke detail pembelian.

### PE-14 — Konsistensi laba dashboard

`monthProfit` di dashboard belum memasukkan penyesuaian stok, sedangkan laporan laba rugi memasukkannya. Gunakan `netProfitOf` yang sama untuk kedua tempat. Acceptance: angka dashboard dan laporan identik untuk periode yang sama.

### PE-15 — Ketahanan transaksi 100 baris

Transaksi memiliki timeout 15 detik dan beberapa query per baris. Ukur p95 untuk 50–100 baris; pertimbangkan batas baris lebih rendah, timeout lebih longgar, atau pengurangan round-trip. Acceptance: pembelian 50 baris selesai tanpa timeout pada DB target.

### PE-16 — Guard perubahan belum tersimpan

Tambahkan konfirmasi saat meninggalkan form yang sudah terisi, toast sukses, dan tombol “Catat lagi” yang mereset form sekaligus merotasi `requestId`. Acceptance: tidak ada input hilang tanpa peringatan dan alur catat-berulang tidak memakai ID lama.

### PE-17 — Pencegahan duplikasi pembelian vs pengeluaran

**Masalah.** Pemilik mencatat pembelian tunai sebagai pengeluaran karena mengira kas belum tercatat, sehingga kas dan laba terhitung dua kali.

**Implementasi.** `createExpenseAction` mencari pembelian pada tanggal yang sama dengan selisih nominal ≤ 1% (minimal Rp 5.000). `createPurchaseAction` melakukan pemeriksaan sebaliknya terhadap pengeluaran, sehingga kasus “pengeluaran dicatat dulu, pembelian menyusul” juga tertangkap. Jika ditemukan, penyimpanan ditolak sampai pengguna mencentang konfirmasi bahwa itu transaksi berbeda; tautan mengarah ke data yang dicurigai. Dialog juga mengarahkan pembelian stok ke menu Pembelian, dan kategori "Pembelian Stok" dihapus.

**Acceptance.** Pengeluaran duplikat tidak tersimpan tanpa konfirmasi; konfirmasi tetap memungkinkan biaya lain; pesan menyebut nomor pembelian dan supplier.

### PE-18 — Reversal pengeluaran

**Masalah.** Pengeluaran salah input tidak bisa dikoreksi tanpa menghapus riwayat.

**Implementasi.** Kolom `reverses_expense_id` + unique index + check constraint + trigger database; action `reverseExpenseAction` mencatat entri negatif bertanggal hari ini dengan kategori dan nominal yang sama, serta alasan wajib. Halaman Pengeluaran menampilkan badge **Koreksi/Dikoreksi** dan tombol **Koreksi** pada baris yang belum dikoreksi.

**Acceptance.** Pengeluaran asli tetap ada; total dan laba kembali; koreksi ganda dan koreksi atas koreksi ditolak; database menolak entri tidak sah.

---

## Keputusan yang perlu diambil sebelum implementasi

1. **Void vs retur:** apakah pembatalan penuh cukup, atau perlu retur parsial per baris?
2. **Kebijakan modal:** modal terakhir, rata-rata, atau tetap acuan katalog?
3. **Batas backdate:** apakah pembelian mundur dibatasi seperti void nota, mengingat DP ikut mengubah arus kas periode lampau?
4. **Tagihan manual:** apakah nomor nota tetap opsional, dan apakah perlu unique index global per supplier?
5. **Lampiran:** penyimpanan lokal/Vercel Blob/S3 dan kebijakan retensi.

## Rencana verifikasi

- Perluas `../tests/unit/purchases.test.ts`: void, requestId reuse, normalisasi nota, laporan kas dengan reversal, modal terakhir.
- Perluas `../tests/e2e/purchases.spec.ts`: back → edit, kode batch otomatis, ringkasan dampak.
- Tambah test kontrak laporan untuk memastikan komponen kas keluar = `netCash`.
- Jalankan `pnpm typecheck`, unit test, dan E2E pada PostgreSQL terisolasi sebelum rilis.