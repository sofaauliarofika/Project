const { PrismaClient } = require('@prisma/client'); //Mengimpor PrismaClient dari paket @prisma/client — kelas untuk berinteraksi dengan database melalui Prisma.
const prisma = new PrismaClient(); //Membuat instance Prisma bernama prisma yang digunakan untuk menjalankan query ke database.

exports.createVoucher = async (req, res) => { //Mengekspor fungsi createVoucher sebagai handler asynchronous (untuk route mis. POST /vouchers). req dan res adalah objek Express request/response.
  try { //Memulai blok try untuk menangani eksekusi normal; error akan ditangani di catch.
    const {
      code,
      discountType,   // "PERCENTAGE" | "AMOUNT"
      discountValue,  // number/decimal
      minOrderValue,  // optional
      active = true,
      startAt,        // optional ISO
      endAt,          // optional ISO
      usageLimit,     // optional int
    } = req.body;
    //Meng-destructure properti dari req.body:
      //code: kode voucher (harus unik).
      //discountType: tipe diskon — diharapkan "PERCENTAGE" atau "AMOUNT".
      //discountValue: nilai diskon (angka atau decimal).
      //minOrderValue: (opsional) minimal subtotal order agar voucher berlaku.
      //active = true: jika tidak dikirim, default true.
      //startAt, endAt: (opsional) tanggal mulai/berakhir dalam format ISO string.
      //usageLimit: (opsional) batas pemakaian voucher (integer).

    if (!code || !discountType || discountValue == null) {
      return res.status(400).json({ message: 'code, discountType, discountValue wajib' });
    } //Validasi dasar: jika code atau discountType kosong, atau discountValue null/undefined, maka kembalikan HTTP 400 (Bad Request) dengan pesan. (== null menangkap null dan undefined).

    const voucher = await prisma.voucher.create({
      data: {
        code,
        discountType,
        discountValue,
        minOrderValue: minOrderValue ?? null,
        active,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        usageLimit: usageLimit ?? null,
      },
    });
    //Membuat record voucher baru di database:
      //Memanggil prisma.voucher.create dengan parameter data berisi field-field voucher.
      //minOrderValue: minOrderValue ?? null — jika minOrderValue tidak diberikan, diset null.
      //startAt dan endAt diparsing menjadi Date jika diberikan; kalau tidak diset null.
      //usageLimit juga diset null jika tidak diberikan.
      //Hasil pembuatan disimpan ke variabel voucher.

    return res.status(201).json(voucher); //Mengembalikan response HTTP 201 (Created) dengan objek voucher yang baru dibuat.
  } catch (error) { //Memulai blok catch untuk menangkap error yang terjadi di dalam try.
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Kode voucher sudah ada' });
    } //Jika error Prisma memiliki kode P2002 (unique constraint violation — kemungkinan code sudah ada), kembalikan HTTP 409 (Conflict) dengan pesan yang jelas.
    return res.status(500).json({ message: error.message });
  }
}; //Untuk error lain, kembalikan HTTP 500 (Internal Server Error) bersama error.message. Tutup blok catch dan tutup fungsi createVoucher.

exports.listVouchers = async (req, res) => { //Mengekspor fungsi listVouchers sebagai handler asynchronous (mis. GET /vouchers) untuk menampilkan daftar voucher dengan pagination dan filter.
  try { //Memulai blok try.
    const { q = '', page = '1', limit = '10', active } = req.query;
    //Mengambil query parameters dari URL:
    //q: string pencarian pada kode voucher, default ''.
    //page: halaman pagination, default '1'.
    //limit: jumlah item per halaman, default '10'.
    //active: filter aktif (string 'true'/'false'), optional.
    const pageNum = Math.max(parseInt(page, 10) || 1, 1); //Mengkonversi page ke integer minimal 1. Jika parse gagal, gunakan 1.
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100); //Mengkonversi limit ke integer dan membatasi nilainya antara 1 dan 100 (mencegah request ambil terlalu banyak).
    const skip = (pageNum - 1) * take; //Menghitung offset (skip) untuk pagination.

    const where = {}; //Inisialisasi objek where (filter) kosong untuk query.
    if (q) where.code = { contains: q, mode: 'insensitive' }; //Jika q diberikan, tambahkan filter pada kolom code menggunakan contains (pencarian substring) dengan mode case-insensitive.
    if (active !== undefined) where.active = active === 'true'; //Jika parameter active ada (bahkan 'false'), set where.active ke boolean true atau false sesuai active === 'true'.

    const [rows, total] = await Promise.all([ //Menjalankan dua query secara paralel menggunakan Promise.all, hasilnya akan di-destruct ke rows dan total.
      prisma.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      //Query pertama: findMany untuk mengambil daftar voucher sesuai where, diurutkan berdasarkan createdAt descending, dengan pagination (skip, take).
      prisma.voucher.count({ where }),
    ]);
    //Query kedua: count untuk menghitung total record yang sesuai where. Keduanya dijalankan bersamaan untuk efisiensi.

    res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
    //Mengembalikan response JSON yang berisi:
    //data: array voucher (rows).
    //meta: metadata pagination (total, page, limit, totalPages).
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//Jika terjadi error dalam try, kirim HTTP 500 dengan pesan error, lalu tutup fungsi listVouchers.

exports.toggleVoucher = async (req, res) => { //Mengekspor fungsi toggleVoucher sebagai handler asynchronous — bertugas membalik status active voucher (aktif ⇄ non-aktif).
  try { //Mulai blok try
    const id = Number(req.params.id); //Mengambil id voucher dari URL parameters dan mengkonversi ke Number.
    const voucher = await prisma.voucher.findUnique({ where: { id } }); //Mencari voucher berdasarkan id di database.
    if (!voucher) return res.status(404).json({ message: 'Voucher tidak ditemukan' }); //Jika voucher tidak ditemukan (null), kembalikan HTTP 404 (Not Found) dengan pesan.

    const updated = await prisma.voucher.update({
      where: { id },
      data: { active: !voucher.active },
    });
    //Melakukan update pada record voucher: set active ke kebalikan nilai saat ini (!voucher.active). Hasil update disimpan di variabel updated.
    res.json(updated); //Mengembalikan objek voucher yang sudah ter-update sebagai JSON (status default 200).
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//Jika ada error, kembalikan HTTP 500 dengan pesan error; tutup fungsi toggleVoucher.
