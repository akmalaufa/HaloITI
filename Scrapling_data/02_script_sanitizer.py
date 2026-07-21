import re
from urllib.parse import urlsplit

print("🧹 Memulai Mesin Pencuci Data (The Sanitizer V2)...")

# 1. Loading Data Mentah
try:
    with open("Daftar_File_Scraping.txt", "r", encoding="utf-8") as f:
        # Pake generator biar RAM lu nggak meledak pas data makin gede
        raw_urls = [line.strip() for line in f if line.strip()]
except FileNotFoundError:
    print("❌ File Daftar_File_Scraping.txt tidak ditemukan!")
    exit()

clean_urls = set()
junk_urls = set()

# 2. KONFIGURASI FILTER (KEBIJAKAN MUTLAK)
# Tambahkan sub-domain sampah yang bikin timeout atau nggak relevan buat RAG PMB
hard_blacklist = [
    "repository.iti.ac.id", 
    "siakad.iti.ac.id", 
    "library.iti.ac.id", 
    "jurnaliptek.iti.ac.id",
    "webmail.iti.ac.id",
    "helpdesk.iti.ac.id"
]

# Pola Regex untuk konten sampah (Compiled biar kenceng)
junk_patterns = re.compile(r'/(tag|category|author|page/\d+)/|/\d{4}/\d{2}/|wp-content/uploads')

print(f"[*] Memilah {len(raw_urls)} link mentah...")

# 3. PROSES PENCUCIAN (CLEANING & FILTERING)
for url in raw_urls:
    # A. NORMALISASI: Jangan langsung buang URL yang ada '?' atau '#'
    # Kita potong buntutnya, ambil dagingnya saja.
    parsed = urlsplit(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    base_url_lower = base_url.lower()

    # B. FILTER 1: Hard Blacklist (Eksekusi mati sub-domain sampah)
    if any(domain in base_url_lower for domain in hard_blacklist):
        junk_urls.add(url) # Kita masukkan URL asli ke sampah buat audit
        continue

    # C. FILTER 2: Junk Patterns (Regex untuk halaman navigasi/arsip)
    if junk_patterns.search(base_url_lower):
        junk_urls.add(url)
        continue

    # D. VALIDASI DOMAIN: Pastikan tetap di dalam iti.ac.id
    if "iti.ac.id" not in base_url_lower:
        junk_urls.add(url)
        continue

    # E. LOLOS SELEKSI: Masukkan hasil yang sudah bersih/normal
    clean_urls.add(base_url)

# 4. SIMPAN HASIL
with open("Daftar_File_Scraping_Bersih.txt", "w", encoding="utf-8") as f:
    for url in sorted(clean_urls): f.write(url + "\n")

with open("Daftar_File_Sampah.txt", "w", encoding="utf-8") as f:
    for url in sorted(junk_urls): f.write(url + "\n")

print("\n✨ PENCUCIAN SELESAI!")
print(f"✅ Daging Murni (Siap di-sweep): {len(clean_urls)} link")
print(f"🗑️ Sampah yang dibuang: {len(junk_urls)} link")