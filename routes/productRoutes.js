// routes/productRoutes.js
const express = require('express');
// Mengimpor modul Express untuk membuat route HTTP.
const router = express.Router();
// Membuat instance router untuk mendefinisikan rute produk secara modular.
const {
  createProduct, getAllProducts, getProductById, updateProduct, deleteProduct,
} = require('../controllers/productController');
// Mengimpor fungsi-fungsi dari controller produk:
// - createProduct → membuat produk baru (admin)
// - getAllProducts → menampilkan semua produk
// - getProductById → menampilkan detail produk berdasarkan ID
// - updateProduct → mengubah data produk (admin)
// - deleteProduct → menghapus produk (admin)

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
// Mengimpor middleware untuk keamanan:
// - verifyToken → memverifikasi token JWT (user harus login).
// - isAdmin → memastikan user yang login memiliki role "admin".


// ADMIN ROUTES 

router.post('/', verifyToken, isAdmin, createProduct);
// Endpoint: POST /products
// Hanya admin yang boleh menambahkan produk baru.
// verifyToken memastikan sudah login, isAdmin memastikan punya hak admin.

router.put('/:id', verifyToken, isAdmin, updateProduct);
// Endpoint: PUT /products/:id
// Hanya admin yang bisa mengedit produk berdasarkan ID.

router.delete('/:id', verifyToken, isAdmin, deleteProduct);
// Endpoint: DELETE /products/:id
// Hanya admin yang bisa menghapus produk berdasarkan ID.


// USER ROUTES 

router.get('/', verifyToken, getAllProducts);
// Endpoint: GET /products
// User yang login bisa melihat semua produk yang tersedia.

router.get('/:id', verifyToken, getProductById);
// Endpoint: GET /products/:id
// User yang login bisa melihat detail produk tertentu berdasarkan ID.

module.exports = router;
// Mengekspor router agar bisa digunakan di file utama (misalnya app.js)
// Biasanya digunakan dengan: app.use('/api/products', router);

