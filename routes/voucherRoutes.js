const express = require('express');
// Mengimpor modul Express untuk membuat rute API.

const router = express.Router();
// Membuat instance router untuk mengelola rute yang berkaitan dengan voucher.

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
// Mengimpor dua middleware penting:
// - verifyToken: memverifikasi apakah pengguna sudah login (punya token JWT).
// - isAdmin: memastikan hanya admin yang bisa mengakses route tertentu.

const {
  createVoucher,
  listVouchers,
  toggleVoucher,
} = require('../controllers/voucherController');
// Mengimpor fungsi controller dari voucherController:
// - createVoucher → membuat voucher baru.
// - listVouchers → menampilkan daftar semua voucher.
// - toggleVoucher → mengubah status aktif/tidak aktif dari voucher tertentu.


//  ROUTE UNTUK ADMIN 

router.post('/', verifyToken, isAdmin, createVoucher);
// Endpoint: POST /vouchers
// Hanya admin yang bisa membuat voucher baru.
// Middleware verifyToken memastikan user login, isAdmin memastikan role-nya admin.

router.get('/', verifyToken, isAdmin, listVouchers);
// Endpoint: GET /vouchers
// Menampilkan semua voucher yang ada (dengan pagination & filter).
// Hanya bisa diakses oleh admin.

router.patch('/:id/toggle', verifyToken, isAdmin, toggleVoucher);
// Endpoint: PATCH /vouchers/:id/toggle
// Mengubah status aktif/tidak aktif dari voucher berdasarkan ID.
// Contoh: dari aktif → nonaktif, atau sebaliknya.
// Hanya admin yang boleh melakukannya.


module.exports = router;
// Mengekspor router agar bisa digunakan di file utama (misalnya app.js),
// biasanya dipanggil dengan: app.use('/api/vouchers', router);
