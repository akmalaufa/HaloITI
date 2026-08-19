# --- RUANGAN 1: Tahap Kotor (Builder) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Kertas Belanjaan: Copy package.json dan package-lock.json
COPY package.json package-lock.json ./

# Proses Belanja Kotor: Install SEMUA dependensi (termasuk devDependencies)
RUN npm ci

# Pindahin Kodingan: Copy seluruh source code frontend lu ke Ruangan 1
COPY . .

# Proses Masak: Lakukan build (ini akan menghasilkan folder .next/standalone yang berisi piring bersih)
RUN npm run build


# --- RUANGAN 2: Tahap Bersih (Runner) ---
FROM node:20-alpine AS runner

WORKDIR /app

# Atur environment ke mode production
ENV NODE_ENV=production

# Memindahkan "Piring Bersih" dari Ruangan 1 (builder) ke Ruangan 2
# 1. Pindahin folder aset statis (gambar, favicon, dll)
COPY --from=builder /app/public ./public

# 2. Pindahin piring utama (aplikasi yang sudah diracik dan di-press oleh fitur standalone)
COPY --from=builder /app/.next/standalone ./

# 3. Pindahin file statis hasil kompilasi Next.js (css, file js frontend)
COPY --from=builder /app/.next/static ./.next/static

# Buka Pintu Warung: Expose port internal Next.js
EXPOSE 3000

# Nyalain Mesin: Jalankan server bawaan hasil standalone Next.js 
# (Bukan pakai 'npm run start' lagi, karena ini lebih cepat dan ringan)
CMD ["node", "server.js"]
