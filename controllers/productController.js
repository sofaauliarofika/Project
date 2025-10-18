// controllers/productController.js
const { PrismaClient, Prisma } = require('@prisma/client');
//Mengimpor PrismaClient (klien DB) dan namespace Prisma (helper, mis. Prisma.Decimal) dari paket Prisma.
const prisma = new PrismaClient(); //Membuat instance Prisma (prisma) yang dipakai untuk semua operasi database (find, create, update, delete, aggregate, dll).

// helper Decimal (hindari float)
const D = (v) => new Prisma.Decimal(v ?? 0); //Helper singkat: bungkus v menjadi Prisma.Decimal. Jika v null/undefined maka pakai 0. Memudahkan operasi matematika yang presisi.

// CREATE (admin) - /products [POST]
exports.createProduct = async (req, res) => { //Mengekspor fungsi createProduct sebagai handler async untuk route POST /products (diasumsikan hanya admin boleh akses — harus diproteksi oleh middleware).
  try { //Mulai blok try untuk error handling.
    const { name, price, description } = req.body; //Ambil name, price, description dari body request.

    if (!name || price == null) { //Validasi: name harus ada dan price tidak boleh null/undefined (menggunakan == null yang menangkap null dan undefined).
      return res.status(400).json({ message: 'name dan price wajib diisi' }); //Jika validasi gagal → kembalikan HTTP 400 dengan pesan.
    }

    // price Decimal
    let priceDec; //Inisialisasi variabel untuk menyimpan nilai price dalam bentuk Decimal.
    try { 
      priceDec = D(price);
    } catch {
      return res.status(400).json({ message: 'Format price tidak valid' });
    } //Coba konversi price ke Decimal via helper D. Jika konversi gagal (mis. format string tidak valid) → kembalikan 400.

    const newProduct = await prisma.product.create({
      data: {
        name,
        price: priceDec,
        description: description ?? null,
        userId: req.user.id, // ambil dari JWT
      },
    }); //Buat record produk baru di DB:
          //name dan price disimpan (price sebagai Decimal).
          //description jika tidak ada jadi null.
          //userId diisi req.user.id (diambil dari JWT middleware — menandakan siapa yang membuat product).

    return res.status(201).json(newProduct); //Kembalikan HTTP 201 (Created) beserta objek product yang baru dibuat.
  } catch (error) {
    return res.status(500).json({ message: error.message });
  } // Tangani error tak terduga dengan HTTP 500 dan pesan error.
}; //Penutup fungsi createProduct.

// READ ALL (user) + search + pagination + sorting - /products [GET]
exports.getAllProducts = async (req, res) => { //Handler untuk route GET /products dengan fitur search, pagination, dan sorting.
  try {
    const {
      q = '',
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query; //Ambil query params: q (search), page, limit, sortBy, sortOrder dengan default jika tidak diberikan.

    // pagination guard
    const pageNum = Math.max(parseInt(page, 10) || 1, 1); //Parse page jadi integer minimal 1 (guard).
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100); //Parse limit jadi take, batasi antara 1 sampai 100 untuk mencegah request ambil terlalu banyak data.
    const skip = (pageNum - 1) * take; //Hitung skip untuk pagination (offset).

    // sorting guard (whitelist kolom)
    const allowedSort = new Set(['createdAt', 'price', 'name', 'updatedAt']); //Daftar kolom yang diizinkan untuk sorting (whitelist).
    const sortKey = allowedSort.has(sortBy) ? sortBy : 'createdAt'; //Pilih sortKey hanya jika termasuk whitelist, kalau tidak fallback ke createdAt.
    const sortDir = (String(sortOrder).toLowerCase() === 'asc') ? 'asc' : 'desc'; //Tentukan arah sort: hanya asc atau default desc.

    // search condition
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}; //Jika q ada, buat kondisi pencarian di name atau description dengan case-insensitive. Jika tidak, where kosong (ambil semua).

    // query utama
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortKey]: sortDir },
        skip,
        take,
        include: {
          user: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.product.count({ where }),
    ]); //Jalankan dua query paralel:
          //findMany untuk mengambil halaman produk sesuai where, orderBy, skip, take, dan sertakan data pembuat (user select).
          //count untuk total item matching (dipakai untuk pagination meta).

    // agregasi rating untuk produk yang tampil
    const ids = items.map((p) => p.id); //Ambil semua id produk yang tampil agar bisa meng-agregasi rating hanya untuk produk ini.
    let aggMap = new Map(); //Inisialisasi map untuk menyimpan hasil agregasi rating keyed by productId.
    if (ids.length > 0) {
      const aggs = await prisma.rating.groupBy({
        by: ['productId'],
        where: { productId: { in: ids } },
        _avg: { value: true },
        _count: { _all: true },
      });
      aggMap = new Map(aggs.map((a) => [a.productId, a]));
    } 
    //Kalau ada id:
      //Gunakan groupBy pada tabel rating untuk produk-produk tersebut.
      //Ambil rata-rata nilai rating (_avg.value) dan jumlah rating (_count._all).
      //Simpan hasilnya di aggMap agar lookup cepat saat membangun data.

    const data = items.map((p) => {
      const a = aggMap.get(p.id);
      const avg = a?._avg?.value ?? null;
      const cnt = a?._count?._all ?? 0;
      return {
        ...p,
        avgRating: avg !== null ? Number(Number(avg).toFixed(2)) : null,
        ratingCount: cnt,
      };
    });
    //Untuk tiap product:
      //Ambil agregasi dari aggMap.
      //Jika ada rata-rata, bulatkan ke 2 desimal dan konversi ke Number; jika tidak ada, set null.
      //Sertakan ratingCount.
      //Kembalikan objek produkt augmented (masih menyertakan field DB asli seperti price yang bisa berupa Decimal — catatan nanti).

    const totalPages = Math.ceil(total / take); //Hitung jumlah halaman total.
    return res.json({
      data,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        sortBy: sortKey,
        sortOrder: sortDir,
        q: q || null,
      },
    });
    //Kembalikan response JSON yang berisi:
      //data: daftar produk (dengan avgRating dan ratingCount).
      //meta: informasi pagination dan parameter yang dipakai.
  } catch (error) {
    return res.status(500).json({ message: error.message });
  } //Tangani error dengan HTTP 500.
}; //Penutup fungsi getAllProducts.

// READ ONE (user) - /products/:id [GET]
exports.getProductById = async (req, res) => {  //Handler GET /products/:id.
  try {
    const id = Number(req.params.id); //Ambil id dari params dan konversi ke Number.
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' }); //Jika konversi gagal → kembalikan 400.

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
      },
    }); //Cari product berdasarkan id dan sertakan informasi pembuat (user).
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' }); //Jika tidak ditemukan → 404.

    // agregasi rating produk
    const agg = await prisma.rating.aggregate({
      where: { productId: id },
      _avg: { value: true },
      _count: { _all: true },
    }); //Hitung agregat rating untuk product ini: rata-rata nilai dan jumlah rating.

    const avg =
      agg._avg.value !== null && agg._avg.value !== undefined
        ? Number(Number(agg._avg.value).toFixed(2))
        : null; //Jika ada nilai rata-rata → bulatkan ke 2 desimal, konversi ke Number; jika tidak, null.

    return res.json({
      ...product,
      avgRating: avg,
      ratingCount: agg._count._all,
    }); //Kembalikan product yang dilengkapi avgRating dan ratingCount.
  } catch (error) {
    return res.status(500).json({ message: error.message });
  } //Tangani error.
}; //Penutup fungsi getProductById.

// UPDATE (admin) - /products/:id [PUT]
exports.updateProduct = async (req, res) => { //Handler PUT /products/:id untuk mengupdate product (diasumsikan admin-only via middleware).
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' }); //Ambil dan validasi id.

    const { name, price, description } = req.body; //Ambil field yang bisa diupdate dari request body.

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'Produk tidak ditemukan' }); //Cek apakah product ada; jika tidak → 404.

    let priceDec;
    if (price !== undefined) {
      try {
        priceDec = D(price);
      } catch {
        return res.status(400).json({ message: 'Format price tidak valid' });
      }
    } //Jika price disertakan di request body (bukan undefined), coba konversi ke Decimal. Jika gagal → 400.

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name ?? exists.name,
        price: priceDec !== undefined ? priceDec : exists.price,
        description: description ?? exists.description,
      },
    });
    //Lakukan update:
      //Kalau name tidak diberikan (undefined), gunakan exists.name (nilai lama).
      //Untuk price, jika priceDec sudah didefinisikan karena user mengirim price, gunakan itu; kalau tidak, tetap pakai exists.price.
      //description juga memakai nilai baru jika ada, kalau tidak pakai nilai lama.

    return res.json(updated); //Kembalikan object product yang sudah diupdate.
  } catch (error) {
    return res.status(500).json({ message: error.message });
  } //Tangani error.
}; //Penutup fungsi updateProduct.

// DELETE (admin) - /products/:id [DELETE]
exports.deleteProduct = async (req, res) => { //Handler DELETE /products/:id.
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' }); //Ambil dan validasi id.

    await prisma.product.delete({ where: { id } }); //Hapus product di DB. Jika product tidak ada, Prisma akan melempar error dengan kode P2025.
    return res.json({ message: 'Produk berhasil dihapus' }); //Jika berhasil hapus → kembalikan pesan sukses.
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    return res.status(500).json({ message: error.message });
  } 
  //Di catch:
    //Jika error kode P2025 (record to delete not found) → kembalikan 404.
    //Untuk error lain → 500.
}; //Penutup fungsi deleteProduct.
