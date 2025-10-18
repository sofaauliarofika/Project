const { PrismaClient } = require('@prisma/client');
//Mengimpor PrismaClient dari paket @prisma/client agar bisa berinteraksi dengan database lewat Prisma.
const prisma = new PrismaClient();
//Membuat instance Prisma bernama prisma yang digunakan untuk menjalankan query (find, create, upsert, dsb).

/**
 * GET /buyer/me
 * - kembalikan profil buyer milik user login
 * - kalau belum ada, auto-bikinin row kosong biar konsisten
 */
exports.getMyBuyerProfile = async (req, res) => {
//Mengekspor fungsi getMyBuyerProfile sebagai handler async. req/res adalah objek Express.
  try {
  //Memulai blok try untuk menangani error; jika terjadi error, eksekusi lompat ke catch.
    const userId = req.user.id;
    //Mengambil id user yang sedang login dari req.user (diasumsikan middleware autentikasi sudah menaruh user di req.user).

    let buyer = await prisma.buyer.findUnique({ where: { id: userId } });
    //Mencari row buyer yang id-nya sama dengan userId. findUnique mengembalikan objek buyer atau null jika tidak ditemukan.
    if (!buyer) {
    //Mengecek apakah hasil query tidak ditemukan (null/falsy).
      buyer = await prisma.buyer.create({
      //Jika belum ada profil buyer untuk user ini, buat satu baris baru (profil kosong minimal).
        data: { id: userId }, // buat profil kosong
        //Data yang dimasukkan hanya id: userId — berarti profil dibuat dengan nilai default untuk kolom lain (jika ada) atau null sesuai skema DB. Komentar menjelaskan tujuan baris ini.
      });
      //Penutup argumen untuk prisma.buyer.create.
    }
    //Penutup if.

    return res.json(buyer);
    //Mengembalikan objek buyer (entah hasil findUnique awal atau hasil create) sebagai respons JSON dengan status 200 default.
  } catch (error) {
  //Menangkap error yang terjadi dalam blok try.
    return res.status(500).json({ message: error.message });
    //Mengembalikan HTTP 500 (Internal Server Error) beserta pesan error.
  }
  //Penutup catch.
};
//Penutup fungsi getMyBuyerProfile.

/**
 * PUT/PATCH /buyer/me
 * - upsert profil buyer untuk user login
 * - hanya field yang diizinkan yang dipakai
 */
exports.upsertMyBuyerProfile = async (req, res) => {
//Mengekspor handler upsertMyBuyerProfile untuk membuat atau mengupdate profil buyer milik user login.
  try {
  //Mulai blok try.
    const userId = req.user.id;
    //Ambil userId dari req.user (dari middleware autentikasi).
    const allowed = [
    //Array allowed berisi nama-nama field yang diizinkan untuk diterima dari request body. Ini mencegah user inject field tak diinginkan (mis. id, createdAt, field sensitif lain).
      'fullName',
      'phone',
      'addressLine1',
      'addressLine2',
      'city',
      'province',
      'postalCode',
      'country',
    ];

    const data = {};
    //Inisialisasi objek data kosong yang nanti diisi hanya field yang diizinkan dan ada di req.body.
    for (const k of allowed) {
    //Mulai loop untuk setiap nama field yang diizinkan.
      if (req.body[k] !== undefined) data[k] = req.body[k];
      //Jika request body mengandung key tersebut (tidak undefined), salin nilainya ke data.
        //Penggunaan !== undefined mencegah menimpa field dengan undefined jika user tidak mengirimkannya.
        //Hanya nilai yang dikirim akan ikut ke data, sehingga operasi update bersifat partial.
    }
    //Akhiri loop

    const buyer = await prisma.buyer.upsert({
    //Panggil upsert: jika row ada (where match), lakukan update; jika tidak ada, lakukan create. Hasilnya disimpan ke buyer.
      where: { id: userId },
      //Kondisi untuk menentukan keberadaan row buyer (menggunakan id sama dengan userId).
      update: data,
      //Jika row ditemukan → update kolom sesuai data yang sudah difilter.
      create: { id: userId, ...data },
      //Jika row tidak ditemukan → buat row baru dengan id: userId dan masukkan semua field dari data.
    });
    //Penutup argumen upsert.

    return res.json(buyer);
    //Kembalikan hasil upsert (objek buyer terbaru) sebagai JSON.
  } catch (error) {
  //Tangkap error.
    return res.status(500).json({ message: error.message });
    //Balas HTTP 500 jika ada error.
  }
  //Penutup catch.
};
//Penutup fungsi upsertMyBuyerProfile.
