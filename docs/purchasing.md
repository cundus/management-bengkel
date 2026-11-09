# Pembelian dan penerimaan barang

Menu **Pembelian** tersedia untuk pemilik, termasuk lewat **Stok & jasa → Barang masuk / pembelian**. Catat saat barang diterima. Pilih supplier, tanggal, nomor nota (opsional), beberapa barang, kode lot, jumlah, dan modal per unit. Harga modal katalog menjadi isian awal, bukan nilai yang mengubah batch lama.

Satu penyimpanan membuat pembelian, batch stok untuk setiap baris, satu tagihan supplier senilai total pembelian, serta pembayaran awal jika ada. Semua berjalan dalam transaksi database yang sama: kegagalan satu baris membatalkan semuanya. Pengiriman form berulang memakai request ID yang sama untuk mencegah stok/tagihan ganda. Nomor nota tidak boleh berulang pada supplier yang sama; lot unik per barang.

- **Tempo:** tagihan terbuka penuh, jatuh tempo wajib diisi.
- **Sebagian:** pembayaran awal mengurangi tagihan, sisa terlihat di Hutang Supplier.
- **Lunas:** tagihan dan pembayaran penuh tetap menjadi riwayat, tanpa hutang berjalan.

Pembayaran berikutnya dari detail pembelian maupun Hutang Supplier memakai tagihan yang sama. Pembayaran mengurangi kas melalui pencatatan pembayaran hutang yang sudah digunakan laporan. Pembelian tidak membuat pengeluaran operasional baru; HPP baru dihitung saat barang terjual sesuai FIFO. Riwayat batch, pembelian, dan tagihan saling memiliki tautan.

Tagihan lama dipertahankan. Tombol **Tagihan lain** tetap tersedia untuk tagihan tanpa penerimaan stok; jangan mencatat ulang pembelian dari tombol tersebut. Penerimaan stok tanpa tagihan tetap tersedia di detail barang untuk saldo awal/penambahan di luar pembelian.

Versi ini mencatat penerimaan lengkap sekali simpan, tanpa PO, penerimaan parsial, retur pembelian, atau pengubahan pembelian yang sudah diterima.

## Migrasi dan rollback

Migrasi `20261109040000_purchasing` hanya menambah tabel `purchases` dan relasi nullable `stock_batches.purchase_id`. Batch dan tagihan lama tetap utuh tanpa dipasangkan secara otomatis. Jalankan `prisma migrate deploy` sebelum versi aplikasi baru menerima trafik; rilis aplikasi melalui Git integration. Tidak perlu reset atau seed database produksi.

Untuk verifikasi, pastikan jumlah awal batch pembelian dikali modal sama dengan total pembelian, total tagihan sama dengan total pembelian, pembayaran tidak melebihi tagihan, serta saldo item sama dengan total sisa batch. Pengujian memakai PostgreSQL test/E2E terpisah.

Rollback kode dapat memakai versi sebelumnya sambil mempertahankan tabel dan kolom baru; pembayaran tagihan tetap tersedia dari Hutang Supplier. Jangan menghapus tabel pembelian atau mengurangi stok untuk rollback. Bekukan penerimaan dari versi baru saat perpindahan; tidak ada langkah penghapusan data otomatis.
