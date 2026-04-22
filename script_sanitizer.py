import re

print("🧹 Memulai Mesin Pencuci Data (The Sanitizer)...")

# 1. Baca data mentah dari hasil scraping lu tadi
try:
    with open("Daftar_File_Scraping.txt", "r", encoding="utf-8") as f:
        raw_urls = [line.strip() for line in f.readlines() if line.strip()]
except Exception:
    print("❌ File Daftar_File_Scraping.txt tidak ditemukan!")
    exit()

clean_urls = set()
junk_urls = set()

# 2. Aturan Mesin Penghancur Sampah (RegEx)
junk_patterns = [
    r'/tag/',                  # Kumpulan tagar
    r'/category/',             # Kumpulan kategori
    r'/author/',               # Profil penulis artikel
    r'/page/\d+',              # Navigasi halaman (page/2, page/3)
    r'/\d{4}/\d{2}/',          # Arsip tanggal (misal: /2023/10/)
    r'#',                      # Anchor menu (misal: #kingster-menu)
    r'\?',                     # Query parameter (termasuk link WhatsApp /?text=)
    r'wp-content/uploads',     # Link langsung ke gambar
    r'library\.iti\.ac\.id'    # Eksekusi mati semua link perpustakaan
]

print(f"[*] Memilah {len(raw_urls)} link mentah...")

# 3. Proses Penyortiran
for url in raw_urls:
    is_junk = False
    for pattern in junk_patterns:
        if re.search(pattern, url.lower()):
            is_junk = True
            break
            
    if is_junk:
        junk_urls.add(url)
    else:
        clean_urls.add(url)

# 4. Simpan ke File Baru
with open("Daftar_File_Scraping_Bersih.txt", "w", encoding="utf-8") as f:
    for url in sorted(clean_urls): 
        f.write(url + "\n")

with open("Daftar_File_Sampah.txt", "w", encoding="utf-8") as f:
    for url in sorted(junk_urls): 
        f.write(url + "\n")

print("\n✨ PENCUCIAN SELESAI!")
print(f"✅ Daging Murni (Siap diekstrak teksnya): {len(clean_urls)} link")
print(f"🗑️ Sampah yang berhasil dibuang: {len(junk_urls)} link")