// prisma/seed.js
require('dotenv').config(); //Memanggil modul dotenv dan menjalankan config() untuk memuat variabel lingkungan dari file .env ke process.env. Berguna supaya ADMIN_EMAIL, ADMIN_PASSWORD, dll. dapat dibaca dari .env.
const { PrismaClient } = require('@prisma/client'); //Mengimpor PrismaClient dari paket @prisma/client — klien yang dipakai untuk berinteraksi dengan database.
const bcrypt = require('bcrypt'); //Mengimpor library bcrypt untuk melakukan hashing password sebelum disimpan ke database.

const prisma = new PrismaClient(); //Membuat instance Prisma bernama prisma. Instance ini digunakan untuk semua query (find, create, update, dsb).

async function main() { //Mendeklarasikan fungsi async main() sebagai entry point skrip seeding. Karena banyak operasi DB asynchronous, fungsi dibuat async.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'; //Membaca variabel lingkungan ADMIN_EMAIL. Jika tidak ada, gunakan fallback 'admin@example.com'.
  const ADMIN_USER  = process.env.ADMIN_USERNAME || 'admin'; //Membaca ADMIN_USERNAME dari environment (fallback 'admin').
  const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'admin123'; //Membaca ADMIN_PASSWORD dari environment (fallback 'admin123'). Ini akan di-hash sebelum disimpan.
  const RESET_PASS  = (process.env.RESET_ADMIN_PASSWORD || 'false').toLowerCase() === 'true'; //Membaca RESET_ADMIN_PASSWORD dari environment; jika tidak ada, default 'false'. Lalu di-normalisasi ke lowercase dan dibandingkan dengan 'true' untuk menghasilkan boolean RESET_PASS. Jika true, skrip akan men-reset password admin yang ada.

  // Cari user existing baik via email atau username
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USER }],
    },
  });
  //Menjalankan query ke DB untuk mencari user pertama yang cocok dengan ADMIN_EMAIL atau ADMIN_USER.
    //findFirst mengembalikan satu record (atau null jika tidak ada).
    //Hasil disimpan di variabel existing.

  if (existing) { //Mengecek apakah ada user existing yang ditemukan. Jika ya, masuk ke blok pembaruan (update) daripada membuat user baru.
    const updates = {}; //Inisialisasi objek kosong updates yang nantinya diisi field-field yang perlu diubah pada user existing.
    if (existing.role !== 'admin') updates.role = 'admin'; //Jika role user saat ini bukan 'admin', tambahkan role: 'admin' ke objek updates — artinya skrip akan menaikkan role menjadi admin.

    if (RESET_PASS) {
      updates.password = await bcrypt.hash(ADMIN_PASS, 10);
    } //Jika RESET_PASS bernilai true, tambahkan properti password ke updates berisi hasil hash dari ADMIN_PASS menggunakan bcrypt.hash dengan salt rounds 10. Ini menandakan password akan di-reset.

    if (Object.keys(updates).length > 0) { //Periksa apakah ada perubahan yang ingin dilakukan (apakah updates tidak kosong). Hanya jika ada perubahan, lakukan update DB.
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: updates,
        select: { id: true, username: true, email: true, role: true },
      }); 
      //Jika perlu update:
      //Panggil prisma.user.update dengan where: { id: existing.id } untuk menargetkan user yang ditemukan.
      //data: updates adalah field-field yang diubah (mis. role dan/atau password).
      //select membatasi field yang dikembalikan — hanya id, username, email, role (tidak mengembalikan password).
      console.log('✅ Admin updated:', updated); //Log ke console bahwa admin diperbarui, disertai data hasil update (id, username, email, role).
    } else { //Kalau updates kosong (tidak perlu perubahan), masuk ke blok else.
      console.log('✅ Admin already exists:', {
        id: existing.id, username: existing.username, email: existing.email, role: existing.role,
      }); //Log bahwa admin sudah ada dan tidak perlu diubah — cetak info dasar user (id, username, email, role).
    }
    return;
  }//Tutup if (existing) dan return dari fungsi main() — jika user sudah ada, setelah branch ini skrip selesai (tidak akan membuat user baru).

  // Tidak ada → buat baru
  const hash = await bcrypt.hash(ADMIN_PASS, 10); //Hash password admin baru (ADMIN_PASS) menggunakan bcrypt dengan salt rounds 10. Hasil disimpan di variabel hash.
  const admin = await prisma.user.create({
    data: {
      username: ADMIN_USER,
      email: ADMIN_EMAIL,
      password: hash,
      role: 'admin',
    },
    select: { id: true, username: true, email: true, role: true },
  });
  //Membuat user baru di tabel user:
  //data berisi username, email, password (hash), dan role: 'admin'.
  //select membatasi field yang dikembalikan (tidak mengembalikan password).
  //Hasil pembuatan disimpan di variabel admin.
  console.log('🎉 Admin created:', admin); //Log bahwa admin berhasil dibuat, tampilkan data singkat admin.
} //Penutup blok fungsi main().

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  //Memanggil fungsi main() dan menambahkan handler catch untuk menangkap exception yang tidak tertangani:
  //Jika main() melempar error, tangkap di .catch, cetak error ke console (console.error(e)), lalu keluar dari proses dengan kode status 1 (process.exit(1)), menandakan kegagalan.
  .finally(async () => {
    await prisma.$disconnect();
  });
  //finally dieksekusi setelah main() selesai atau setelah .catch. Di sini melakukan await prisma.$disconnect() untuk menutup koneksi Prisma/DB dengan rapi sebelum proses Node.js berhenti.
