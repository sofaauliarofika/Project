const { PrismaClient } = require('@prisma/client');
//Mengimpor kelas PrismaClient dari paket @prisma/client. PrismaClient adalah klien untuk berkomunikasi dengan database yang dikonfigurasi lewat Prisma.
const prisma = new PrismaClient();
//Membuat instance baru PrismaClient bernama prisma — instance ini dipakai untuk menjalankan query ke database (mis. findUnique, update).

exports.promoteToAdmin = async (req, res) => {
//Mengekspor fungsi promoteToAdmin sebagai property dari module. Fungsi ini async sehingga bisa memakai await. Parameter req dan res adalah objek request dan response dari Express (atau framework serupa).
  try {
  //Memulai blok try untuk menangani potensi error secara terkontrol. Jika ada error dalam blok ini, eksekusi lompat ke catch.
    const id = Number(req.params.id);
    //Membaca id dari parameter URL (req.params.id) lalu mengkonversinya ke tipe Number. Ini memastikan id bertipe angka untuk dipakai di query database.
    //Catatan: jika req.params.id bukan angka, Number(...) menghasilkan NaN — sebaiknya divalidasi lebih ketat.
    const user = await prisma.user.findUnique({ where: { id } });
    //Menanyakan database untuk mencari satu baris user dengan id yang cocok. findUnique mengembalikan objek user atau null jika tidak ditemukan. await menunggu hasil query.
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    //Jika user bernilai falsy (mis. null), maka fungsi langsung mengembalikan respons HTTP 404 dengan JSON berisi pesan bahwa user tidak ditemukan. return menghentikan eksekusi fungsi setelah mengirim respons.

    const updated = await prisma.user.update({
    //Menjalankan operasi update terhadap baris user di database — hasil update nanti disimpan di variabel updated. await menunggu operasi selesai.
      where: { id },
      //Menentukan kondisi where untuk update: baris user yang id-nya sama dengan variabel id.
      data: { role: 'admin' },
      //Menetapkan data yang akan diubah: kolom role di-set menjadi string 'admin'.
      select: { id: true, username: true, email: true, role: true },
      //Menentukan fields yang ingin dikembalikan oleh query update. Hanya id, username, email, dan role yang akan ada di objek updated (menghindari mengembalikan field sensitif seperti password).
    });
    //Penutup objek argumen untuk prisma.user.update.

    return res.json({ message: 'User dipromosikan jadi admin', user: updated });
    //Mengirim respons JSON (status default 200) berisi pesan sukses dan data user yang sudah diperbarui (updated). return memastikan fungsi selesai setelah mengirim respons.
  } catch (err) {
  //Memulai blok catch untuk menangkap error yang terjadi di dalam try.
    return res.status(500).json({ message: err.message });
    //Jika terjadi error tak terduga, mengembalikan HTTP 500 (Internal Server Error) dan pesan error dari exception (err.message) dalam bentuk JSON.
  }
  //Penutup blok catch.
};
//Penutup definisi fungsi arrow yang diekspor.
