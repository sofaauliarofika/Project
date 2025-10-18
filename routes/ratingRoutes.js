const express = require('express');
// Mengimpor modul Express untuk membuat route HTTP.

const router = express.Router();
// Membuat instance router untuk mengelola rute terkait rating produk.

const { verifyToken } = require('../middleware/authMiddleware');
// Mengimpor middleware untuk memverifikasi token JWT agar hanya user yang login bisa mengakses route ini.

const {
  upsertRating,
  listProductRatings,
  getMyRatingForProduct,
} = require('../controllers/ratingController');
// Mengimpor fungsi dari controller rating:
// - upsertRating → menambah atau mengubah rating user terhadap suatu produk.
// - listProductRatings → menampilkan semua rating dari suatu produk.
// - getMyRatingForProduct → mengambil rating milik user tertentu untuk produk spesifik.


//  USER MEMBERI RATING 

router.post('/:productId', verifyToken, upsertRating);
// Endpoint: POST /ratings/:productId
// User yang login dapat memberikan rating pertama kali pada produk tertentu.

router.put('/:productId', verifyToken, upsertRating);
// Endpoint: PUT /ratings/:productId
// User yang login dapat memperbarui (update) rating yang sudah pernah diberikan.

router.patch('/:productId', verifyToken, upsertRating);
// Endpoint: PATCH /ratings/:productId
// Alternatif dari PUT — bisa digunakan untuk memperbarui sebagian data rating.


//  MELIHAT RATING PRODUK 

router.get('/product/:productId', verifyToken, listProductRatings);
// Endpoint: GET /ratings/product/:productId
// Menampilkan semua rating yang diberikan oleh semua user untuk produk tertentu.


// MELIHAT RATING SENDIRI

router.get('/me/:productId', verifyToken, getMyRatingForProduct);
// Endpoint: GET /ratings/me/:productId
// Mengambil rating milik user yang sedang login untuk produk tertentu.

module.exports = router;
// Mengekspor router agar bisa digunakan di file utama (misalnya app.js)
// Biasanya dipanggil dengan: app.use('/api/ratings', router);
