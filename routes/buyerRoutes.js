const express = require('express'); //Mengimpor modul Express, framework Node.js untuk membuat server dan route HTTP dengan mudah.
const router = express.Router(); //Membuat instance Router dari Express — digunakan untuk menampung rute-rute khusus bagian buyer, agar lebih terstruktur dan modular.
const { verifyToken } = require('../middleware/authMiddleware'); //Mengimpor fungsi middleware verifyToken dari file authMiddleware.
//Middleware ini berfungsi memeriksa validitas token JWT pada setiap request yang membutuhkan autentikasi (hanya user yang sudah login bisa mengakses).
const { getMyBuyerProfile, upsertMyBuyerProfile } = require('../controllers/buyerController');
//Mengimpor dua fungsi controller dari buyerController:
//getMyBuyerProfile — untuk mengambil data profil buyer milik user yang sedang login.
//upsertMyBuyerProfile — untuk membuat (insert) atau memperbarui (update) profil buyer milik user login.

// Lihat profil buyer milik user yang login
router.get('/me', verifyToken, getMyBuyerProfile);
//Mendefinisikan endpoint GET /me:
//Middleware verifyToken dijalankan dulu → memverifikasi JWT.
//Jika valid, Express lanjut ke getMyBuyerProfile untuk mengambil profil buyer milik user yang login (biasanya berdasarkan req.user.id dari token).

// Update/isi profil buyer milik user yang login
router.put('/me', verifyToken, upsertMyBuyerProfile);
router.patch('/me', verifyToken, upsertMyBuyerProfile);
//Dua route ini (PUT dan PATCH /me) digunakan untuk mengupdate atau mengisi profil buyer milik user login:
//Keduanya memakai middleware verifyToken → memastikan hanya user terautentikasi yang bisa mengubah datanya sendiri.
//Handler upsertMyBuyerProfile akan menambahkan data jika belum ada (insert), atau memperbarui data jika sudah ada (update).
//PUT biasanya digunakan untuk mengganti seluruh data profil.
//PATCH digunakan untuk mengganti sebagian field saja.Tapi keduanya diarahkan ke fungsi sama agar lebih fleksibel.

module.exports = router; //Mengekspor router agar bisa digunakan di file utama (biasanya di app.js atau server.js).
