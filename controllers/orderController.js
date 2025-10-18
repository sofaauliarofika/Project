const { PrismaClient, OrderStatus, Prisma } = require('@prisma/client');
const { PrismaClient, OrderStatus, Prisma } = require('@prisma/client');
//Mengimpor tiga hal dari package Prisma client:
  //PrismaClient — klien untuk berkomunikasi dengan database.
  //OrderStatus — enum (nilai konstan) yang didefinisikan di schema Prisma untuk status order (mis. PENDING, PAID, dsb).
  //Prisma — namespace utilitas Prisma yang berisi helper, termasuk Prisma.Decimal.
const prisma = new PrismaClient();
//Membuat instance Prisma (prisma) untuk menjalankan query ke DB.

// helper Decimal (hindari float)
const D = (v) => new Prisma.Decimal(v ?? 0);
//Komentar menjelaskan tujuan: menggunakan Decimal untuk menghindari masalah floating-point pada operasi uang.
//const D = (v) => new Prisma.Decimal(v ?? 0);
//Helper singkat: jika v null/undefined -> pakai 0, lalu bungkus sebagai Prisma.Decimal. Memudahkan operasi matematika aman-desimal.

// validate voucher
async function validateVoucher(code, subtotal) {
//Fungsi async untuk validasi voucher berdasarkan code dan subtotal order.
  if (!code) return { voucher: null, discount: D(0) };
  //Kalau code falsy → langsung return voucher null dan diskon 0.

  const now = new Date();
  //Ambil waktu sekarang untuk cek periode voucher.
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  //Cari voucher berdasarkan code.
  if (!voucher || !voucher.active) return { voucher: null, discount: D(0) };
  //Jika voucher tidak ditemukan atau non-aktif → tidak valid.

  if (voucher.startAt && now < voucher.startAt) return { voucher: null, discount: D(0) };
  //Jika ada startAt dan sekarang belum mencapai waktu mulai → tidak valid.
  if (voucher.endAt && now > voucher.endAt) return { voucher: null, discount: D(0) };
  //Jika ada endAt dan sudah lewat → tidak valid.
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    return { voucher: null, discount: D(0) };
  }
  //Jika ada batas pemakaian (usageLimit) dan usedCount sudah mencapai/lebih → tidak valid.
  if (voucher.minOrderValue && D(subtotal).lessThan(voucher.minOrderValue)) {
    return { voucher: null, discount: D(0) };
  }
  //Jika ada syarat minimal nilai order dan subtotal lebih kecil → tidak valid.

  let discount = D(0);
  //Inisialisasi diskon.
  if (voucher.discountType === 'PERCENTAGE') {
    discount = D(subtotal).mul(voucher.discountValue).div(100).toDecimalPlaces(2);
    //Jika tipe diskon persentase → hitung subtotal * discountValue / 100, kemudian dibulatkan ke 2 desimal.
  } else {
    // AMOUNT
    discount = Prisma.Decimal.min(D(voucher.discountValue), D(subtotal)).toDecimalPlaces(2);
  }
  //Kalau tipe diskon nominal (amount) → gunakan nilai diskon maksimum voucher.discountValue namun tidak boleh melebihi subtotal (pakai min), lalu 2 desimal.
  return { voucher, discount };
}
//Kembalikan objek voucher (record) + jumlah diskon Decimal.
//Catatan: fungsi ini hanya membaca DB; tidak mengubah usedCount. Kebijakan update usedCount ditangani di tempat lain (mis. saat order PAID).

/**
 * POST /orders
 * body: { items: [{productId, quantity}], voucherCode? }
 */
exports.createOrder = async (req, res) => {
//Handler untuk membuat order baru.
  try {
    const userId = req.user.id;
    //Ambil userId dari req.user (middleware autentikasi).
    const { items, voucherCode } = req.body;
    //Ambil items dan voucherCode dari request body.

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items wajib diisi' });
    }
    //Validasi items: kalau bukan array atau kosong → kembalikan 400.

    // Ambil produk sekaligus, map per id untuk efisiensi
    const productIds = items.map(i => Number(i.productId));
    //Kumpulkan productId yang diperlukan (cast ke Number).
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    });
    //Ambil semua produk sekaligus berdasarkan productIds. Hanya butuh id dan price.

    const productMap = new Map(products.map(p => [p.id, p]));
    //Buat map id -> product agar lookup O(1).
    

    // Build orderItems dengan snapshot harga
    const orderItems = [];
    for (const it of items) {
      const pid = Number(it.productId); //id produk.
      const qty = Math.max(parseInt(it.quantity ?? 1, 10), 1); //parse quantity, minimal 1.
      const prod = productMap.get(pid);
      if (!prod) {
        return res.status(400).json({ message: `Produk ${pid} tidak ditemukan` });
      } //Cek prod ada di productMap; kalau tidak → kembalikan 400 produk tidak ditemukan.
      const unitPrice = prod.price; // Decimal dari DB
      //ambil harga unit (Decimal).
      const subtotal = D(unitPrice).mul(qty).toDecimalPlaces(2);
      //subtotal per item (Decimal, 2 desimal).

      orderItems.push({
        productId: pid,
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: subtotal,
      });
    } //Push objek order item snapshot (productId, quantity, unitPrice, subtotal).
      //Catatan: snapshot harga berguna kalau harga produk berubah nanti; order menyimpan harga saat pembelian.

    // subtotal order
    const subtotal = orderItems.reduce((acc, it) => acc.add(it.subtotal), D(0)).toDecimalPlaces(2); //Menjumlah semua subtotal item (Decimal).

    // voucher (opsional)
    const { voucher, discount } = await validateVoucher(voucherCode, subtotal);
    //Fungsi sebelumnya menentukan apakah voucher valid dan besar diskon.

    const total = D(subtotal).sub(discount).toDecimalPlaces(2); //Total setelah diskon, 2 desimal.

    // Simpan dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          subtotal,
          discount,
          total,
          voucherId: voucher ? voucher.id : null,
          items: {
            create: orderItems.map(it => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.subtotal,
            })),
          },
        },
        include: {
          items: true,
          voucher: true,
        },
      });

      // Catatan: umumnya usedCount voucher dinaikkan saat order PAID,
      // tapi kalau tugasmu minta di saat create, aktifkan kode ini:
      // if (voucher) {
      //   await tx.voucher.update({
      //     where: { id: voucher.id },
      //     data: { usedCount: { increment: 1 } },
      //   });
      // }

      return order;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /orders
 * query (opsional): page, limit, status
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = '1', limit = '10', status } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    const where = { userId };
    if (status && Object.values(OrderStatus).includes(status)) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          voucher: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Penjelasan:
// Ambil userId dari req.user.
// Ambil query params page, limit, status (default page=1, limit=10).
// Parse pageNum, batasi take antara 1..100, hit skip.
//Bangun where = { userId }. Jika status valid (terdaftar di OrderStatus), tambahkan filter status.
//Jalankan dua query paralel via Promise.all:
  //findMany untuk mengambil rows (dengan skip, take, orderBy) dan include items (beserta nama product) dan voucher.
  //count untuk total matching rows (dipakai untuk pagination meta).
//Kembalikan JSON dengan data (rows) dan meta berisi total, page, limit, totalPages.
//catch mengembalikan 500.

/**
 * GET /orders/:id
 * - hanya pemilik order atau admin
 */
exports.getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        voucher: true,
        user: { select: { id: true, username: true, role: true } },
      },
    });
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const isOwner = order.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Tidak boleh melihat order orang lain' });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Penjelasan:
//Ambil id dari params (cast ke Number).
//Cari order beserta items (dengan nama product), voucher, dan user (field terbatas).
//Jika tidak ditemukan → 404.
//Cek authorization: hanya pemilik (order.userId === req.user.id) atau admin (req.user.role === 'admin') yang boleh melihat order. Jika bukan → 403.
//Jika lulus → kembalikan order.


/**
 * GET /orders/admin/list (admin)
 * query: page, limit, status, q (by username or email)
 */
exports.adminListOrders = async (req, res) => {
  try {
    const { page = '1', limit = '10', status, q = '' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    const where = {};
    if (status && Object.values(OrderStatus).includes(status)) {
      where.status = status;
    }
    if (q) {
      where.user = {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, username: true, email: true } },
          voucher: true,
          items: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Penjelasan:
//Endpoint untuk admin list order (dengan pagination, filter status, dan pencarian q di username/email).
//Parse page/limit/skip.
//Bangun filter where. Jika q diberikan, filter menggunakan relasi user dengan OR pada username atau email (case-insensitive).
//Jalankan findMany + count paralel, sertakan user/voucher/items.
//Kembalikan data + meta pagination.
//Catatan: Pastikan middleware route ini memeriksa req.user.role === 'admin' sehingga endpoint benar-benar aman.


/**
 * PATCH /orders/:id/status (admin)
 * body: { status: "PAID" | "SHIPPED" | "COMPLETED" | "CANCELED" }
 * - contoh kebijakan: increment voucher.usedCount saat status menjadi PAID
 */
exports.adminUpdateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({ where: { id } });
      if (!before) return null;

      const after = await tx.order.update({
        where: { id },
        data: { status },
        include: { voucher: true },
      });

      // Kebijakan: hit voucher usage saat order jadi PAID (sekali saja)
      if (
        after.voucherId &&
        status === 'PAID' &&
        before.status !== 'PAID'
      ) {
        await tx.voucher.update({
          where: { id: after.voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return after;
    });

    if (!updated) return res.status(404).json({ message: 'Order tidak ditemukan' });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//Penjelasan:
//Ambil id dari params dan status dari body.
//Validasi status apakah masuk ke enum OrderStatus; jika tidak valid → 400.
//Gunakan transaction:
//Ambil before state order. Jika tidak ditemukan → return null (diproses setelah transaction).
//Update order status (after) dan include voucher.
//Kebijakan: jika order memiliki voucherId dan status baru adalah 'PAID' sementara sebelumnya bukan 'PAID', maka increment voucher.usedCount satu kali. Ini mencegah multiple increments jika status sudah PAID.
//Kembalikan after.
//Jika updated null → 404 order tidak ditemukan; else return updated.
//catch → 500.