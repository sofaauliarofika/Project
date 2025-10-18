const express = require('express'); //Mengimpor modul express. Dibutuhkan untuk membuat Router atau aplikasi Express.
const router = express.Router(); //Membuat instance Router dari Express. router ini akan menampung definisi route (endpoint) yang kemudian diekspor dan dipasang ke app utama.
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
//Mengimpor dua middleware dari file ../middleware/authMiddleware:
//verifyToken: middleware yang memverifikasi keberadaan dan keabsahan JWT, lalu menempelkan req.user.
//isAdmin: middleware yang memeriksa req.user.role agar hanya admin yang boleh melanjutkan.Urutan impor di sini hanya mengambil fungsi; urutan eksekusi ditentukan saat dipakai di route.
const { promoteToAdmin } = require('../controllers/adminController'); //Mengimpor handler controller promoteToAdmin dari ../controllers/adminController. Fungsi ini yang akan dieksekusi jika request lolos middleware.

router.patch('/users/:id/promote', verifyToken, isAdmin, promoteToAdmin);
//Mendefinisikan route HTTP PATCH pada path /users/:id/promote di router:
//'/users/:id/promote' — path dengan parameter :id (biasanya ID user yang ingin dipromosikan).
//verifyToken — middleware pertama yang memastikan request punya token JWT yang valid; jika valid, req.user diisi.
//isAdmin — middleware kedua yang memastikan req.user.role === 'admin'; jika bukan admin, request diblokir.
//promoteToAdmin — controller yang menangani logika promosi user menjadi admin (mis. update role di DB).Urutan ini penting: middlewares dieksekusi dari kiri ke kanan; controller hanya dipanggil kalau semua middleware memanggil next().

module.exports = router; //Mengekspor instance router sehingga file ini bisa di-require dan dipasang di aplikasi utama (mis. app.use('/api', require('./routes/adminRoutes'))).
