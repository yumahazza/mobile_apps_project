# Aplikasi Presensi Praktikum (PPK) — Expo / React Native

Aplikasi mobile presensi praktikum berbasis **React Native (Expo SDK 58)** dengan **Firebase Authentication**, **Cloud Firestore** (real-time `onSnapshot` & transaksi atomik), serta klasifikasi AI untuk alasan izin dan analisis sentimen pesan/kesan praktikan.

---

## Fitur Utama (Sprint 2)

1. **Autentikasi & Role-Based Routing (`assistant` / `student`)**
   - Login dan registrasi akun Firebase Auth dengan penyimpanan profil pengguna di koleksi `users/{uid}`.
   - Penjagaan akses otomatis di `AppNavigator` serta aturan akses ketat di `firestore.rules`.
2. **Manajemen Jadwal & Peserta Real-time**
   - CRUD jadwal praktikum untuk Asisten (`ScheduleScreen`) beserta manajemen peserta kelas (`ParticipantRoster`).
   - Sinkronisasi real-time per role menggunakan `onSnapshot`.
3. **Kontrol Sesi & Presensi Anti-Duplikasi**
   - Transisi status sesi atomik (`BELUM_DIBUKA` → `DIBUKA` → `SELESAI`) melalui `sessionControlService`.
   - Presensi praktikan dengan dokumen ID komposit `${scheduleId}_${studentId}` dan transaksi Firestore.
4. **Pengajuan Izin, Klasifikasi AI & Approval Asisten**
   - Praktikan dapat mengajukan izin ketidakhadiran (`MENUNGGU`), dipantau real-time oleh Asisten (`LeaveApprovalScreen`).
   - Klasifikasi otomatis oleh AI (`Sakit`, `Urusan Keluarga`, `Akademik/Lomba`, `Kendala Teknis`, `Alasan Kurang Kuat`) dengan fallback aman `"AI Tidak Merespon / Perlu Cek Manual"`.
   - Persetujuan Asisten (`DITERIMA`) secara atomik mencatat status `Izin` ke koleksi `attendances`.
5. **Pesan & Kesan Pasca-Praktikum + Sentimen AI**
   - Form pesan & kesan aktif setelah sesi berstatus `SELESAI`, diklasifikasikan ke `Positif`, `Negatif`, `Netral`, atau `Tidak Terklasifikasi` menggunakan endpoint eksternal (opsional) atau model lokal `ai/model-edom.json`.

---

## Setup Pengembangan

1. **Install dependensi:**
   ```bash
   npm install
   ```

2. **Konfigurasi Environment Opsional (`.env`):**
   Jika ingin mengaktifkan endpoint AI eksternal / Gemini API (tanpa ini, aplikasi otomatis memakai classifier lokal + fallback aman):
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=...
   EXPO_PUBLIC_AI_LEAVE_URL=...
   EXPO_PUBLIC_AI_SENTIMENT_URL=...
   ```

3. **Deploy Firestore Security Rules:**
   Pastikan isi file `firestore.rules` telah di-publish ke Firebase project `ppk-praktikum-2a6ab` (via Firebase Console **Firestore Database → Rules → Publish** atau `firebase deploy --only firestore:rules --project ppk-praktikum-2a6ab`).

4. **Provisioning Akun Asisten:**
   Registrasi mandiri melalui aplikasi selalu membuat pengguna dengan `role: "student"`. Untuk akun Asisten uji, ubah field `role` pada dokumen `users/{uid}` di Firebase Console menjadi `"assistant"`.

---

## Akun Demo

Gunakan kredensial berikut untuk mencoba aplikasi berdasarkan peran:

| Peran | Email | Password |
| --- | --- | --- |
| **Asisten** | `asisten@gmail.com` | `Asisten` |
| **Mahasiswa** | `mahasiswa@gmail.com` | `Mahasiswa` |

---

## Build & Pengujian

### Verifikasi Statis & Automated E2E Logic Test
```bash
npx tsc --noEmit
npx eslint .
node scripts/test-e2e-uat.js
```

### Build Development Client (Wajib untuk Modul Native Firebase)
Aplikasi menggunakan `@react-native-firebase/app`, `@react-native-firebase/auth`, dan `@react-native-firebase/firestore`, sehingga membutuhkan Development Build (tidak dapat dijalankan di Expo Go):

```bash
npx eas-cli@latest build --profile development --platform android
# atau build lokal jika Android SDK terpasang:
npx expo run:android
```

---

## Checklist UAT Perangkat Fisik (2 Akun: Asisten & Praktikan)

1. **Auth & Role:** Daftar akun Praktikan baru → tutup dan buka ulang aplikasi → pastikan sesi login bertahan dan diarahkan ke `StudentStack`. Login dengan akun Asisten → pastikan diarahkan ke `AssistantStack`.
2. **Jadwal & Peserta:** Di akun Asisten, buat jadwal baru dan centang Praktikan uji → pastikan jadwal langsung muncul di akun Praktikan tanpa me-restart aplikasi.
3. **Kontrol Sesi & Presensi:** Buka sesi dari Asisten → cek tombol `Presensi Sekarang` aktif di Praktikan → lakukan presensi → pastikan status menjadi `Hadir` dan percobaan kedua dicegah.
4. **Pengajuan & Approval Izin:** Dari akun Praktikan lain yang terdaftar di kelas, ajukan izin → cek di `LeaveApprovalScreen` Asisten muncul dengan badge klasifikasi AI → klik `Terima` → cek status di Praktikan berubah menjadi `DITERIMA` / `Izin Disetujui` dan rekap Asisten mencatat `Izin = 1`.
5. **Feedback Sentimen:** Asisten menutup sesi (`SELESAI`) → Praktikan mengirim Pesan & Kesan → cek badge sentimen AI tampil di `FeedbackSection` dan di `SessionRecapScreen` Asisten.
6. **Hapus Jadwal & Notifikasi:** Cek halaman `Notifications` menampilkan aktivitas real-time sesuai akun, dan hapus jadwal non-`DIBUKA` melalui modal konfirmasi.
