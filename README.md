# Web Penomoran Surat (Cloud Version)

Aplikasi ini sekarang sudah disiapkan untuk:
- Hosting online via **GitHub Pages**
- Simpan data ke **cloud (Firebase Firestore)**, bukan `localStorage`
- Login admin via **Firebase Authentication (email + password)**

## 1) Persiapan Akun Cloud (Firebase)

1. Buka https://console.firebase.google.com
2. Klik **Create a project**
3. Setelah project jadi, buka **Project settings** > **General** > **Your apps** > pilih **Web app**
4. Salin konfigurasi Firebase (apiKey, authDomain, projectId, appId, dll)
5. Buka file `cloud-config.js`, lalu ganti semua nilai `GANTI_...` dengan nilai dari Firebase
6. Di `adminEmails`, isi email admin yang boleh login mode admin

Contoh:
```js
adminEmails: ["admin@domain.com"]
```

## 2) Aktifkan Database Firestore

1. Di Firebase Console, buka **Firestore Database**
2. Klik **Create database**
3. Pilih lokasi region (contoh: `asia-southeast2` Jakarta)
4. Setelah jadi, buka tab **Rules**

Untuk tahap awal (paling mudah), gunakan rule ini:
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /apps/{appId} {
      allow read, write: if true;
    }
  }
}
```

Catatan: rule di atas mudah dipakai, tapi belum ketat secara keamanan.

Jika ingin lebih aman (hanya admin cloud yang boleh ubah data), pakai ini:
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /apps/{appId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in ['admin@domain.com'];
    }
  }
}
```
Ganti `admin@domain.com` sesuai email admin Anda.
Dalam mode aman ini, input data juga harus dilakukan saat sudah login admin.

## 3) Aktifkan Login Admin (Email/Password)

1. Buka **Authentication** > **Sign-in method**
2. Aktifkan **Email/Password**
3. Buka tab **Users** > **Add user**
4. Buat user admin (email + password)
5. Pastikan email admin ini juga ada di `adminEmails` pada `cloud-config.js`

## 4) Upload ke GitHub

1. Buat repository baru di GitHub
2. Upload semua file di folder ini
3. Pastikan file utama bernama **index.html** (sudah benar)

## 5) Publish ke GitHub Pages

1. Masuk ke repo GitHub > **Settings**
2. Buka menu **Pages**
3. Pada **Source** pilih `Deploy from a branch`
4. Branch: `main`, folder: `/ (root)`
5. Klik **Save**
6. Tunggu URL terbit (biasanya beberapa menit)

## 6) Uji Setelah Online

1. Buka URL GitHub Pages
2. Tes tambah data Surat + PKB
3. Refresh halaman: data harus tetap ada (karena cloud)
4. Tes login admin dengan email/password Firebase
5. Tes reset, edit, hapus, backup JSON, upload JSON

## Struktur Data Cloud

Data disimpan di koleksi Firestore:
- `apps/surat-keluar`
- `apps/pkb`

Setiap dokumen berisi:
- `data` (array entri)
- `counters` (counter nomor per tahun)
- `history` (riwayat aktivitas)
- `updatedAt` (timestamp server)

## Penting

- Aplikasi ini **sudah tidak memakai localStorage** untuk data utama.
- Kalau `cloud-config.js` belum diisi benar, aplikasi akan menampilkan peringatan cloud belum siap.
