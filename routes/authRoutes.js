const express = require('express'); //Mengimpor modul express. Diperlukan untuk membuat Router atau aplikasi Express.
const router = express.Router(); //Membuat instance Router dari Express. router ini akan menampung rute-rute (endpoints) terkait autentikasi yang lalu diekspor dan dipasang ke aplikasi utama.
const { register, login, me } = require('../controllers/authController'); //Mengimpor tiga fungsi handler (controller) dari file ../controllers/authController:
//register — handler untuk mendaftar user baru (biasanya POST /register).
//login — handler untuk autentikasi user dan menghasilkan token (biasanya POST /login).
//me — handler untuk mengambil profil user yang sedang login (biasanya GET /me).
const { verifyToken } = require('../middleware/authMiddleware'); //Mengimpor middleware verifyToken dari ../middleware/authMiddleware. Middleware ini memverifikasi token JWT yang dikirim client dan menempelkan informasi user ke req.user jika token valid.

router.post('/register', register); //Mendefinisikan route HTTP POST /register yang mengeksekusi handler register.
//Saat ada POST ke /register, Express akan memanggil fungsi register(req, res) untuk memproses pendaftaran.
router.post('/login', login); //Mendefinisikan route HTTP POST /login yang mengeksekusi handler login.
//Endpoint ini biasanya menerima email/username dan password, lalu mengembalikan JWT jika berhasil.
router.get('/me', verifyToken, me);
//Mendefinisikan route HTTP GET /me yang memakai middleware verifyToken sebelum memanggil handler me. Urutan eksekusi:
//verifyToken dijalankan dulu untuk memastikan request membawa token JWT yang valid dan menempatkan info user di req.user.
//Jika token valid, next() dipanggil dan me akan dieksekusi untuk mengembalikan profil user.
//Jika token tidak ada/invalid, verifyToken akan menolak request (mis. 401/403) dan me tidak akan dipanggil.

module.exports = router; //Mengekspor instance router sehingga file ini bisa require di file utama aplikasi (mis. app.use('/api/auth', require('./routes/auth'))), lalu semua route di dalamnya tersedia di path tersebut.
