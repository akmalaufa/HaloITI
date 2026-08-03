# Panduan Deployment Frontend (Next.js) & Konfigurasi Nginx di VPS

Panduan ini berisi langkah-langkah komprehensif untuk merilis (deploy) antarmuka *Frontend* Next.js ke lingkungan produksi (VPS) menggunakan PM2, serta menjadikan Nginx sebagai "Satpam Resepsionis" untuk menyatukan Frontend dan Backend di bawah satu domain dengan gembok keamanan HTTPS.

> [!NOTE]
> Panduan ini adalah kelanjutan dari **Panduan Deployment Backend**. Pastikan *Backend* (FastAPI) sudah menyala di port `8000` menggunakan PM2 sebelum melanjutkan panduan ini.

---

## 1. Menyiapkan Kodingan Frontend

Kita asumsikan Anda masih berada di dalam VPS yang sama, dan repositori sudah di-*clone* saat mengatur *backend* sebelumnya.

```bash
# Pindah ke direktori frontend di dalam repositori lu
cd ~/nama-repo-lu/frontend

# Install seluruh library dari package.json
npm install
```

---

## 2. Konfigurasi Variabel Rahasia (.env)

Sama seperti backend, file `.env` untuk Next.js harus dibuat manual di VPS.

```bash
# Buat dan buka file .env menggunakan editor Nano
nano .env
```

Salin dan sesuaikan isi file di bawah ini. Pastikan `NEXT_PUBLIC_API_URL` mengarah ke domain publik VPS Anda yang nantinya akan diatur oleh Nginx.

```env
# URL API Backend (Sangat Penting! Nginx akan melempar ini ke port 8000)
NEXT_PUBLIC_API_URL=https://pmb.haloiti.com/api

# Konfigurasi NextAuth (Keamanan Login)
NEXTAUTH_URL=https://pmb.haloiti.com
NEXTAUTH_SECRET=super_secret_jwt_key_harus_sama_dengan_backend

# Google OAuth (Opsional, jika Anda memakai fitur login Google)
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```
Simpan dengan menekan `Ctrl + X`, lalu `Y`, dan `Enter`.

---

## 3. Membangun (Build) dan Menyalakan Frontend

Next.js wajib di-*build* terlebih dahulu agar kodingan React (TypeScript) dikonversi menjadi HTML/CSS/JS statis yang sangat cepat.

```bash
# Lakukan proses Build (Ini mungkin memakan waktu 1-2 menit)
npm run build

# Nyalakan server produksi Next.js menggunakan PM2 di port default (3000)
pm2 start npm --name "pmb-frontend" -- run start

# Kunci konfigurasi PM2 agar otomatis nyala saat server restart
pm2 save
```

> [!TIP]
> Jika Anda mengecek `pm2 status` sekarang, Anda seharusnya melihat 2 baris hijau: `pmb-backend` dan `pmb-frontend`. Kedua mesin Anda sudah menyala sempurna di dalam gedung (VPS)!

---

## 4. Instalasi Nginx (Sang Resepsionis)

Sekarang kita akan memasang Nginx untuk menerima tamu dari luar internet.

```bash
# Install Nginx
sudo apt install nginx -y

# Buka firewall untuk mengizinkan traffic HTTP dan HTTPS masuk
sudo ufw allow 'Nginx Full'
```

---

## 5. Konfigurasi Nginx (Reverse Proxy)

Kita harus memberi instruksi kepada Nginx agar ia tahu kemana harus mengoper *traffic* tamu.

```bash
# Buat file konfigurasi baru untuk domain Anda
sudo nano /etc/nginx/sites-available/pmb
```

Tempelkan instruksi (konfigurasi) berikut ke dalam Nano:

```nginx
server {
    listen 80;
    server_name pmb.haloiti.com; # GANTI DENGAN DOMAIN LU NANTI

    # 1. Oper traffic halaman web utama ke Ruang 3000 (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 2. Oper traffic yang menuju /api ke Ruang 8000 (FastAPI Backend)
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Pengaturan khusus jika Backend butuh waktu lama untuk memproses AI (Mencegah Timeout 504)
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```
Simpan dengan menekan `Ctrl + X`, lalu `Y`, dan `Enter`.

### Aktifkan Konfigurasi Nginx
```bash
# Aktifkan file konfigurasi dengan membuat symbolic link (jalan pintas)
sudo ln -s /etc/nginx/sites-available/pmb /etc/nginx/sites-enabled/

# Cek apakah pengetikan konfigurasi lu ada yang typo (wajib "syntax is ok")
sudo nginx -t

# Jika OK, restart Nginx agar efeknya terasa
sudo systemctl restart nginx
```

> [!IMPORTANT]
> Pada tahap ini, *website* lu sudah bisa diakses lewat internet menggunakan `http://pmb.haloiti.com`. Namun belum aman karena gembok hijau (HTTPS) belum terpasang.

---

## 6. Memasang Gembok SSL/HTTPS (Certbot)

Langkah terakhir adalah meminta sertifikat keamanan gratis dari Let's Encrypt.

```bash
# Install Certbot dan plugin Nginx
sudo apt install certbot python3-certbot-nginx -y

# Jalankan Certbot untuk meminta sertifikat (Ganti domainnya)
sudo certbot --nginx -d pmb.haloiti.com
```

Ikuti instruksi di layar (masukkan alamat email Anda, tekan `Y` untuk menyetujui, dll). Certbot secara ajaib akan mengubah file konfigurasi Nginx lu dan menambahkan sertifikat HTTPS secara otomatis.

**🎉 SELAMAT! ARSITEKTUR CLOUD ANDA SUDAH SEMPURNA! 🎉**
Aplikasi PMB ITI kini dapat diakses dengan aman di `https://pmb.haloiti.com`.
