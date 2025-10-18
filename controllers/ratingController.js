const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
//Baris 1–2: Mengimpor PrismaClient dari library @prisma/client dan membuat instance baru prisma untuk digunakan dalam query database.

exports.upsertRating = async (req, res) => {
  try { //Mendefinisikan fungsi upsertRating sebagai asynchronous (karena menggunakan await untuk query database).
        //try digunakan agar jika ada error, bisa ditangani di blok catch.
    const userId = req.user.id;
    const productId = Number(req.params.productId);
    const { value, comment } = req.body;
    //Mengambil userId dari user yang sedang login (req.user).
    //Mengambil productId dari parameter URL.
    //Mengambil value (nilai rating 1–5) dan comment (komentar) dari body request.

    const v = Number(value);
    if (!v || v < 1 || v > 5) {
      return res.status(400).json({ message: 'value harus 1..5' });
    } //Mengubah value jadi angka.
      //Jika v bukan angka valid antara 1–5, maka kembalikan error 400 Bad Request.

    // pastikan product ada
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    //Mengecek apakah produk dengan productId tersebut ada di database.
    //Jika tidak ada, kembalikan 404 Not Found.

    const rating = await prisma.rating.upsert({
      where: { userId_productId: { userId, productId } }, // sesuai @@unique([userId, productId])
      update: { value: v, comment: comment ?? null },
      create: { userId, productId, value: v, comment: comment ?? null },
      select: { id: true, value: true, comment: true, productId: true, userId: true, updatedAt: true },
    });
    //Menggunakan upsert:
      //Jika kombinasi (userId, productId) sudah ada, maka update nilai dan komentar.
      //Jika belum ada, maka buat baru (create).
    //comment ?? null berarti jika comment undefined, diset null.
    //select menentukan field mana yang dikembalikan ke client.

    return res.status(200).json({ message: 'Rating tersimpan', rating }); //Mengirim respon sukses dengan data rating.
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}; //Menangani error tak terduga, kembalikan 500 Internal Server Error.

exports.listProductRatings = async (req, res) => {
  try { //Membuat fungsi asynchronous untuk mengambil daftar rating produk.
    const productId = Number(req.params.productId);
    const { page = '1', limit = '10' } = req.query;
    //Mengambil productId dari URL.
    //Mengambil parameter query page dan limit untuk pagination (default: 1 dan 10).

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;
    //Mengubah page dan limit ke integer yang valid.
    //take = jumlah data per halaman, skip = jumlah data yang dilewati.

    // pastikan produk ada
    const exists = await prisma.product.findUnique({ where: { id: productId } });
    if (!exists) return res.status(404).json({ message: 'Produk tidak ditemukan' });
    //Pastikan produk ada di database sebelum menampilkan rating.

    const [rows, total, agg] = await Promise.all([
      prisma.rating.findMany({
        where: { productId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, username: true } } },
      }),
      prisma.rating.count({ where: { productId } }),
      prisma.rating.aggregate({
        where: { productId },
        _avg: { value: true },
        _count: { _all: true },
      }),
    ]);
     //Menjalankan tiga query secara paralel:
      //findMany: ambil daftar rating dengan pagination.
      //count: total semua rating.
      //aggregate: menghitung rata-rata nilai rating (_avg.value) dan jumlah rating (_count._all).

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
        average: agg._avg.value ? Number(agg._avg.value.toFixed(2)) : null,
        count: agg._count._all,
      },
    }); //Mengembalikan hasil ke client:
          //data: daftar rating
          //meta: informasi pagination dan rata-rata rating.
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}; //Menangani error jika query gagal.

exports.getMyRatingForProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = Number(req.params.productId);
    //Mengambil userId dari user login, dan productId dari parameter URL.

    const rating = await prisma.rating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true, value: true, comment: true, updatedAt: true },
    });
    //Mencari rating berdasarkan kombinasi unik (userId, productId).
    //Hanya mengambil field yang dibutuhkan.

    if (!rating) return res.status(404).json({ message: 'Kamu belum memberi rating untuk produk ini' });
    return res.json(rating); //Jika belum pernah memberi rating → tampilkan pesan 404.
                              //Jika sudah → tampilkan datanya.
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}; //Menangani error internal.
