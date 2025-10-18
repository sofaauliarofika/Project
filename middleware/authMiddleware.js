const jwt = require('jsonwebtoken'); //Mengimpor library jsonwebtoken, yang digunakan untuk membuat dan memverifikasi token JWT.
const JWT_SECRET = process.env.JWT_SECRET || 'fallbackSecret_change_me';
//Mendefinisikan secret key untuk enkripsi dan verifikasi token JWT.
//Jika variabel environment JWT_SECRET tidak tersedia, maka akan menggunakan nilai default 'fallbackSecret_change_me' (namun ini sebaiknya diganti di production agar aman).

exports.verifyToken = (req, res, next) => { //Mendefinisikan secret key untuk enkripsi dan verifikasi token JWT.
//Jika variabel environment JWT_SECRET tidak tersedia, maka akan menggunakan nilai default 'fallbackSecret_change_me' (namun ini sebaiknya diganti di production agar aman).
  const authHeader = req.headers['authorization']; //Mengambil nilai header Authorization dari request (biasanya berformat "Bearer <token>").
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"
  //Jika header ada, maka diambil bagian kedua (setelah spasi) yaitu token-nya.
  //Contoh: "Bearer eyJhbGciOiJIUzI1NiIs..." → token = "eyJhbGciOiJIUzI1NiIs...".
  if (!token) return res.status(403).json({ message: 'Token tidak ditemukan' }); //Jika token tidak ditemukan, kirim respons 403 Forbidden karena permintaan tidak memiliki token.

  try {
    const decoded = jwt.verify(token, JWT_SECRET); //Mencoba memverifikasi token menggunakan jwt.verify().
    //Jika valid, token akan didekode menjadi objek payload (biasanya berisi { id, email, role }).
    req.user = decoded; // { id, email, role }
    //Menyimpan hasil decode ke req.user agar bisa digunakan oleh middleware atau handler selanjutnya.
    next(); //Melanjutkan proses ke middleware atau route handler berikutnya karena token valid.
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid' });
  } //Jika token salah, expired, atau rusak, maka tangkap error dan kirim 401 Unauthorized.
};

exports.isAdmin = (req, res, next) => { //Mendefinisikan middleware isAdmin untuk membatasi akses hanya untuk user dengan role admin.
  if (req.user?.role !== 'admin') { //Mengecek apakah properti role dari req.user bukan 'admin'.
  //Tanda ?. memastikan tidak error kalau req.user belum ada.
    return res.status(403).json({ message: 'Akses ditolak, khusus admin!' });
  } //Jika bukan admin, kirim respons 403 Forbidden.
  next(); //Jika user adalah admin, lanjut ke fungsi berikutnya.
};
