const express = require('express');  
// Mengimpor library Express untuk membuat router dan endpoint HTTP.
const router = express.Router();  
// Membuat instance router baru dari Express agar rute lebih modular dan rapi.
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');  
// Mengimpor dua middleware:
// - verifyToken → memverifikasi JWT agar hanya user yang login bisa mengakses.
// - isAdmin → memastikan hanya user dengan role admin yang bisa lanjut.
const {
  createOrder,
  getMyOrders,
  getOrderById,
  adminListOrders,
  adminUpdateStatus,
} = require('../controllers/orderController');
// Mengimpor fungsi controller dari file orderController untuk menangani logika tiap route:
// - createOrder → membuat pesanan baru
// - getMyOrders → mengambil daftar pesanan milik user yang login
// - getOrderById → mengambil detail pesanan berdasarkan ID
// - adminListOrders → menampilkan semua pesanan (khusus admin)
// - adminUpdateStatus → memperbarui status pesanan (khusus admin)


//USER 

router.post('/', verifyToken, createOrder);
// Endpoint POST /orders
// Hanya bisa diakses jika user login (verifyToken).
// Digunakan user untuk membuat pesanan baru.
router.get('/', verifyToken, getMyOrders);
// Endpoint GET /orders
// Mengambil semua pesanan milik user yang sedang login (berdasarkan user ID di token).
router.get('/:id', verifyToken, getOrderById);
// Endpoint GET /orders/:id
// Mengambil detail satu pesanan tertentu milik user login berdasarkan parameter ID di URL.


// ADMIN ROUTES 

router.get('/admin/list', verifyToken, isAdmin, adminListOrders);
// Endpoint GET /orders/admin/list
// Hanya bisa diakses oleh admin (verifyToken + isAdmin).
// Menampilkan daftar semua pesanan dari seluruh user.
router.patch('/:id/status', verifyToken, isAdmin, adminUpdateStatus);
// Endpoint PATCH /orders/:id/status
// Hanya admin yang bisa mengubah status pesanan (misalnya: pending → shipped).

module.exports = router;
// Mengekspor router ini agar bisa digunakan di file utama server (app.js).
// Biasanya akan digunakan dengan: app.use('/api/orders', router);
