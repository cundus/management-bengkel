# Panduan Pengguna WMC 225

Panduan singkat untuk pemilik dan kasir bengkel.

## Masuk

1. Buka alamat aplikasi di browser ponsel.
2. Masukkan email dan kata sandi. Di versi demo gunakan tombol **Pemilik** atau **Kasir** (`owner@wmc225.id` / `kasir@wmc225.id`, sandi `wmc225`).
3. Untuk memasang di layar utama: menu browser → **Tambahkan ke layar utama / Install app**.

## Alur harian kasir

### 1. Saat pelanggan datang
- Ketuk **Transaksi Baru** (tombol + di kanan atas atau menu Transaksi).
- Pilih pelanggan. Jika pelanggan baru, ketuk **Tambah baru** dan isi data + kendaraan.
- Tambahkan jasa dan sparepart dengan mengetuk item. Atur jumlah dengan tombol +/−.
- Isi nama mekanik dan catatan bila perlu.

### 2. Saat pembayaran
Pilih salah satu:
- **Lunas** — seluruh total dibayar sekarang.
- **DP** — masukkan nominal uang muka; sisa otomatis menjadi piutang.
- **Belum** — belum ada uang diterima; seluruh total menjadi piutang.

Periksa ringkasan, lalu **Simpan & buka nota**. Nota mendapat nomor otomatis.

### 3. Mencetak / membagikan nota
- **Cetak nota** membuka dialog cetak browser.
- **Unduh** menghasilkan CSV rincian nota.
- **Tagih via WA** membuka WhatsApp dengan pesan sisa tagihan (jika ada).

### 4. Menerima pembayaran piutang
- Dari daftar **Piutang**, ketuk **Bayar** pada pelanggan terkait.
- Masukkan nominal (bisa separuh atau penuh), pilih metode, simpan.
- Status berubah otomatis: *DP/Sebagian* → *Lunas* saat sisa nol.
- Untuk mengingatkan, ketuk **Ingatkan** (WhatsApp).

## Alur pemilik

### Pengeluaran
Menu **Pengeluaran** → **Catat pengeluaran**. Pilih kategori (Gaji, Sewa, Listrik & Air, Pembelian Stok, dll.), isi nominal dan keterangan. Pengeluaran mengurangi laba bersih di laporan.

### Hutang supplier
1. Tambahkan **Supplier baru** sekali saja.
2. **Catat hutang** saat barang diterima secara kredit: nominal, referensi, jatuh tempo.
3. Saat membayar, ketuk **Bayar** dan catat nominal. Riwayat termin tersimpan.

Pembayaran hutang bukan biaya baru; ia mengurangi kas dan kewajiban.

### Stok
Menu **Stok & jasa**:
- Tambah/edit item, harga jual, modal, stok, dan stok minimum.
- Stok sparepart otomatis berkurang saat nota disimpan.
- Item di bawah minimum diberi tanda **Menipis** dan muncul di dashboard.

### Laporan
Menu **Laporan**:
- Pilih bulan, lihat omset, laba, kas, piutang, grafik harian, biaya, metode bayar, item terlaris.
- **Ekspor laporan** menghasilkan CSV siap dibuka di Excel/Google Sheets.
- Rincian per hari tersedia di bagian bawah halaman.

### Pembatalan nota
- Hanya pemilik.
- Hanya jika **belum ada pembayaran**.
- Buka detail nota → **Batalkan transaksi** → isi alasan.
- Stok sparepart otomatis dikembalikan.

## Peran & akses

| Fitur | Pemilik | Kasir |
| --- | :---: | :---: |
| Dashboard, transaksi, pembayaran, piutang | ✅ | ✅ |
| Pelanggan & kendaraan | ✅ | ✅ |
| Laporan | ✅ | ✅ |
| Stok (lihat & edit) | ✅ | lihat saja |
| Pengeluaran | ✅ | ❌ |
| Hutang supplier | ✅ | ❌ |
| Pengaturan & void nota | ✅ | ❌ |

## Tips agar catatan tetap akurat

1. Simpan nota **sebelum** pelanggan pergi; jangan menunda ke akhir hari.
2. Setiap uang masuk—termasuk DP—harus dicatat, bukan hanya pelunasan.
3. Catat pengeluaran di hari yang sama.
4. Lakukan pengecekan stok fisik minimal seminggu sekali; bandingkan dengan menu Stok.
5. Jika salah input, jangan menghapus database. Untuk nota tanpa pembayaran gunakan pembatalan; untuk kasus lain hubungi pengelola sistem/lihat roadmap koreksi pembayaran.
6. Aktifkan backup otomatis dari provider PostgreSQL dan uji restore secara berkala (lihat DEPLOYMENT).

## Pertanyaan umum

**Apakah omset sama dengan uang di kas?**
Tidak. Omset adalah nilai nota. Uang di kas adalah **kas diterima** (termasuk pelunasan piutang lama dan DP). Keduanya ditampilkan terpisah.

**Kenapa laba bisa negatif?**
Jika biaya bulan berjalan lebih besar dari laba kotor. Ini bisa normal di awal bulan ketika gaji/sewa dibayar lebih dulu. Periksa rincian biaya.

**Apakah data tersimpan di ponsel?**
Data tersimpan di database PostgreSQL bengkel (server/Vercel). Ponsel hanya menampilkan. PWA memungkinkan install, tetapi fitur tulis offline belum tersedia.

**Bagaimana jika lupa kata sandi?**
Versi MVP belum memiliki reset mandiri. Pemilik dapat memakai `pnpm db:create-admin` dengan email yang sama untuk mengganti kata sandi, atau menunggu fitur manajemen pengguna (roadmap P1).
