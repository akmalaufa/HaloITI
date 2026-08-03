# Panduan Deployment Backend (FastAPI) di VPS Ubuntu

Panduan ini berisi langkah-langkah komprehensif untuk merilis (deploy) layanan *backend* kecerdasan buatan berbasis **FastAPI** ke lingkungan produksi (VPS) menggunakan sistem operasi Linux Ubuntu.

> [!NOTE]
> Panduan ini berasumsi bahwa Anda sudah berhasil masuk (SSH) ke dalam server VPS teman Anda dan memiliki hak akses *root* atau `sudo`.

---

## 1. Persiapan Sistem (Prerequisites)

Sebelum menarik kode dari GitHub, pastikan server VPS sudah dilengkapi dengan perangkat lunak pendukung utama.

```bash
# Update repository server
sudo apt update && sudo apt upgrade -y

# Install Python3, pip, dan virtual environment
sudo apt install python3 python3-pip python3-venv git curl -y

# Install Node.js & NPM (Dibutuhkan untuk menginstal PM2)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 secara global
sudo npm install -g pm2
```

> [!TIP]
> PM2 sebenarnya adalah Process Manager untuk ekosistem Node.js, namun sangat tangguh dan populer digunakan untuk menjaga proses Python (Uvicorn) agar tetap hidup (Keep-Alive) di latar belakang.

---

## 2. Mengambil Kode Sumber (Clone Repository)

Tarik kode aplikasi dari repositori GitHub Anda ke dalam server.

```bash
# Pindah ke direktori /var/www (standar industri untuk web app) atau folder home Anda
cd ~

# Clone repository (Ganti URL dengan link repo Anda)
git clone https://github.com/username-lu/nama-repo-lu.git

# Masuk ke folder backend
cd nama-repo-lu/backend
```

---

## 3. Konfigurasi Lingkungan Python (Virtual Environment)

Sangat penting untuk mengisolasi *library* proyek Anda agar tidak merusak paket sistem bawaan Ubuntu.

```bash
# Buat Virtual Environment dengan nama 'venv'
python3 -m venv venv

# Aktifkan Virtual Environment
source venv/bin/activate
```

> [!IMPORTANT]
> Pastikan prompt di terminal Anda sekarang memiliki prefix `(venv)`. Jika iya, berarti ruang isolasi sudah aktif.

```bash
# Install seluruh library pendukung (FastAPI, Gemini, Pinecone, Supabase, dll)
pip install -r requirements.txt
```

---

## 4. Konfigurasi Variabel Rahasia (.env)

Karena file `.env` tidak ikut terbawa dari GitHub, Anda wajib membuatnya secara manual di VPS.

```bash
# Buat dan buka file .env menggunakan editor Nano
nano .env
```

Salin (*copy*) seluruh kredensial dari file `.env` di laptop lokal Anda, lalu tempel (*paste*) ke dalam terminal VPS.

Tekan `Ctrl + X`, ketik `Y`, lalu tekan `Enter` untuk menyimpan.

---

## 5. Menjalankan Server dengan PM2

Kini saatnya menyalakan *backend* FastAPI. Kita akan menjalankan **Uvicorn** namun dikendalikan penuh oleh **PM2**.

```bash
# Jalankan FastAPI di port 8000 (hanya via localhost) dan aktifkan proxy-headers
pm2 start "uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers" --name "pmb-backend"
```

> [!WARNING]
> Pastikan perintah di atas dijalankan saat Anda **berada di dalam folder `backend`** dan `venv` masih dalam status **aktif**.

Jika berhasil, PM2 akan menampilkan tabel indikator hijau dengan nama `pmb-backend` yang menandakan status aplikasi `online`.

---

## 6. Mengunci Aplikasi (Auto-Start on Boot)

Agar *backend* otomatis menyala sendiri setiap kali VPS mati lampu atau di-*restart*:

```bash
# Bekukan daftar aplikasi yang sedang berjalan di PM2
pm2 save

# Buat script auto-start (Jalankan perintah ini, lalu ikuti instruksi yang muncul di terminal)
pm2 startup
```
*(Setelah menjalankan `pm2 startup`, PM2 biasanya akan menyuruh Anda melakukan `copy-paste` sebuah perintah panjang yang diawali dengan kata `sudo`. Tempel dan jalankan perintah tersebut).*

---

## 7. Pemantauan & Manajemen Server (Cheatsheet)

Setelah layanan berjalan di lingkungan produksi, berikut adalah daftar perintah PM2 yang wajib Anda ketahui untuk keperluan pemeliharaan (*maintenance*):

| Perintah | Fungsi |
| :--- | :--- |
| `pm2 status` | Melihat daftar status aplikasi (Nyala/Mati). |
| `pm2 logs pmb-backend` | Membaca log aktivitas terminal *secara live* (berguna untuk melihat pesan eror). |
| `pm2 restart pmb-backend` | Me-*restart* server (wajib dilakukan jika Anda baru saja mengubah kodingan atau isi file `.env`). |
| `pm2 stop pmb-backend` | Mematikan layanan *backend* sementara. |

> [!TIP]  
> **Langkah Selanjutnya:** Setelah *backend* berhasil berjalan di port `8000`, langkah berikutnya adalah men-*deploy* antarmuka **Next.js (Frontend)** menggunakan PM2 di port `3000`, lalu membungkus keduanya di balik **Nginx Reverse Proxy** agar dapat diakses menggunakan nama domain kampus secara aman (HTTPS).
