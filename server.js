const express = require('express');                      // Import framework Express untuk membuat server HTTP
const app = express();                                   // Inisialisasi aplikasi Express
require('dotenv').config();                              // Memuat variabel lingkungan dari file .env ke dalam process.env

const PORT = process.env.PORT || 3000;                   // Mengambil port dari .env, jika tidak ada maka default ke 3000

const authRoutes = require('./routes/authRoutes');        // Import rute untuk autentikasi (login, register, dll)
const productRoutes = require('./routes/productRoutes');  // Import rute untuk produk
const buyerRoutes = require('./routes/buyerRoutes');      // Import rute untuk pembeli
const orderRoutes = require('./routes/orderRoutes');      // Import rute untuk pesanan (order)
const voucherRoutes = require('./routes/voucherRoutes');  // Import rute untuk voucher diskon
const ratingRoutes = require('./routes/ratingRoutes');    // Import rute untuk rating produk
const adminRoutes = require('./routes/adminRoutes');      // Import rute untuk fungsi admin

app.use(express.json());                                 // Middleware untuk parsing data JSON dari request body

app.get('/health', (_, res) => res.json({ ok: true }));  // Endpoint sederhana untuk memeriksa apakah server aktif

app.use('/auth', authRoutes);                            // Mengatur prefix /auth untuk semua rute autentikasi
app.use('/products', productRoutes);                     // Prefix /products untuk semua rute produk
app.use('/buyer', buyerRoutes);                          // Prefix /buyer untuk rute pembeli
app.use('/orders', orderRoutes);                         // Prefix /orders untuk rute pesanan
app.use('/vouchers', voucherRoutes);                     // Prefix /vouchers untuk rute voucher
app.use('/ratings', ratingRoutes);                       // Prefix /ratings untuk rute rating produk
app.use('/admin', adminRoutes);                          // Prefix /admin untuk rute admin

// error handler
app.use((err, req, res, next) => {                       // Middleware untuk menangani error secara global
  console.error(err);                                    // Menampilkan error di console
  res.status(err.status || 500).json({                   // Mengirimkan respons error ke client
    message: err.message || 'Internal error'             // Pesan error default jika tidak ada pesan spesifik
  });
});

app.listen(PORT, () => {                                 // Menjalankan server di port yang ditentukan
  console.log(`Server running on http://localhost:${PORT}`); // Menampilkan pesan bahwa server sudah berjalan
});
