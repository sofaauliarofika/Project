const { PrismaClient } = require('@prisma/client');
//Mengimpor PrismaClient dari package @prisma/client untuk akses database.
const bcrypt = require('bcrypt');
//Mengimpor library bcrypt untuk meng-hash (mengacak) password sebelum disimpan ke database.
const jwt = require('jsonwebtoken');
//Mengimpor library jsonwebtoken untuk membuat dan memverifikasi token JWT saat login.
const prisma = new PrismaClient();
//Membuat instance Prisma untuk menjalankan query database.

const JWT_SECRET = process.env.JWT_SECRET || 'fallbackSecret_change_me';
//process.env.JWT_SECRET
//Mengambil secret key dari environment variable (aman untuk production).Jika tidak ada, gunakan default 'fallbackSecret_change_me' (untuk testing saja, sebaiknya diganti di produksi).

//register (untuk mendaftar user baru)
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    //Mengambil data dari body request (username, email, password, dan role).

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, dan password wajib diisi!' });
    }
    //Jika salah satu dari username, email, atau password kosong → kirim error HTTP 400 (Bad Request).

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    //Mengecek apakah email dan username sudah digunakan sebelumnya.Digunakan Promise.all() agar dua query berjalan paralel (lebih cepat).
    if (existingEmail) return res.status(409).json({ message: 'Email sudah terdaftar' });
    if (existingUsername) return res.status(409).json({ message: 'Username sudah dipakai' });
    //Jika ada user dengan email/username yang sama → kirim error HTTP 409 (Conflict).

    const hash = await bcrypt.hash(password, 10);
    //Meng-hash password dengan bcrypt. Angka 10 adalah salt rounds (semakin besar = lebih aman, tapi lebih lambat).

    //Membuat data user baru di tabel user.
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hash,
        role: role === 'admin' ? 'admin' : 'user', // optional: batasi siapa yg boleh bikin admin
      },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
    //Password disimpan dalam bentuk hash.
    //Role hanya akan menjadi 'admin' jika dikirim 'admin' (kalau tidak, jadi 'user').
    // select digunakan agar data sensitif seperti password tidak dikirim kembali ke frontend.

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    //Membuat token JWT berisi id, email, dan role user. Token ini valid selama 1 jam (1h).

    return res.status(201).json({ message: 'Register berhasil', user: newUser, token });
    //Mengirim respons HTTP 201 (Created) berisi pesan sukses, data user baru, dan token JWT.
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Menangkap error tak terduga, lalu mengirim HTTP 500 (Server Error).

//Fungsi 2: login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    //Mengambil email dan password dari request body.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan!' });
    //Mencari user berdasarkan email. Jika tidak ditemukan → kirim HTTP 404 (Not Found).

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Password salah!' });
    //Membandingkan password yang dikirim user dengan password hash di database. Jika tidak cocok → kirim HTTP 401 (Unauthorized).

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    //Jika password cocok → buat token JWT berisi informasi user.

    return res.json({ message: 'Login berhasil!', token, role: user.role });
    //Kirim respons sukses dengan token dan role user (bisa dipakai untuk frontend menentukan akses admin/user).
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Tangani error internal server.

exports.me = async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
    return res.json(me);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//req.user.id diambil dari hasil middleware autentikasi JWT (biasanya didekode dari token sebelumnya).
//Query user berdasarkan id, lalu kembalikan data tanpa password.
//Jika sukses → kirim data user (profil).
//Jika gagal → kirim error 500.
