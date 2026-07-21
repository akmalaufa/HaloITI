import os
import time
import json
import tempfile
from collections import deque
from urllib.parse import urljoin, urlsplit
from scrapling import StealthyFetcher

print("[*] Memulai Operasi Sapu Bersih (V3.1 - Anti-CMS Trap & Stealth Mode)...")

# --- 1. KONFIGURASI MUTLAK ---
target_domain = "iti.ac.id"
sosmed_keywords = ["instagram.com", "facebook.com", "twitter.com", "x.com", "wa.me", "youtube.com", "tiktok.com", "linkedin.com"]
manual_keywords = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", "docs.google.com", "forms.google.com", "drive.google.com"]

# Hard Blacklist untuk menghindari Spider Trap, Timeout, & Data Dinamis
blacklist_keywords = [
    # 1. Subdomain Non-PMB / Operasional Kampus
    "siakad.iti.ac.id", "jurnaliptek.iti.ac.id", "helpdesk.iti.ac.id", "semnas.iti.ac.id",
    "webmail.iti.ac.id", "library.iti.ac.id", "repository.iti.ac.id", "ejournal.iti.ac.id",
    
    # 2. Path & Kata Kunci Berita (Hapus garis miring agar lebih sensitif)
    "/berita", "berita", "news", "artikel", "blog", 
    "pengumuman", "agenda", "events", "kegiatan", "webinar",
    "laporan", "kunjungan", "prestasi", "kompetisi", "juara", "arsip",
    
    # 3. Jebakan CMS (WordPress Pagination, Tags, Archive, Author)
    "/page/", "/tag/", "/category/", "/author/", "/wp-json/", "/xmlrpc.php",
    
    # 4. Blokir Tahun (Menangkap format /2024/ maupun strip -2024-)
    "-2021", "-2022", "-2023", "-2024", "-2025", "-2026",
    "2021/", "2022/", "2023/", "2024/", "2025/", "2026/"
]

if os.path.exists("Blacklist_Web.txt"):
    with open("Blacklist_Web.txt", "r", encoding="utf-8") as f:
        blacklist_keywords.extend([line.strip().lower() for line in f.readlines() if line.strip()])

# --- 2. DATA STATE (IN-MEMORY) ---
to_visit = deque()           # Antrean URL (FIFO) - O(1)
visited_links = set()        # URL yang sudah sukses di-fetch - O(1)
link_scraping_unique = set() # Master List URL "Daging" final
link_lineage_scraping = {}   # Audit: Parent URL -> List of Child URLs
link_manual = {}             # Audit: Parent URL -> List of Manual Files
link_sosmed = {}             # Audit: Parent URL -> List of Sosmed Links

# --- 3. SISTEM CHECKPOINT (LOAD) ---
def load_json_to_set_dict(filename):
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            return {k: set(v) for k, v in json.load(f).items()}
    return {}

if os.path.exists("Sisa_Antrean.txt") and os.path.exists("Sejarah_Kunjungan.txt"):
    print("[*] Checkpoint ditemukan. Melanjutkan misi...")
    with open("Sisa_Antrean.txt", "r", encoding="utf-8") as f:
        to_visit = deque([line.strip() for line in f if line.strip()])
    with open("Sejarah_Kunjungan.txt", "r", encoding="utf-8") as f:
        visited_links = set([line.strip() for line in f if line.strip()])
    if os.path.exists("Daftar_File_Scraping_Massal.txt"):
        with open("Daftar_File_Scraping_Massal.txt", "r", encoding="utf-8") as f:
            link_scraping_unique = set([line.strip() for line in f if line.strip()])
    
    link_lineage_scraping = load_json_to_set_dict("State_Lineage.json")
    link_manual = load_json_to_set_dict("State_Manual.json")
    link_sosmed = load_json_to_set_dict("State_Sosmed.json")
else:
    print("[*] Memulai misi baru dari bibit URL bersih...")
    if os.path.exists("Daftar_File_Scraping_Bersih.txt"):
        with open("Daftar_File_Scraping_Bersih.txt", "r", encoding="utf-8") as f:
            seeds = [line.strip() for line in f if line.strip()]
            to_visit = deque(seeds)
            for s in seeds: link_scraping_unique.add(s)
    else:
        print("❌ Error: File Daftar_File_Scraping_Bersih.txt tidak ditemukan!")
        exit()

# --- 4. CORE ENGINE (CRAWLING) ---
MAX_PAGES = 20000
count = 0

try:
    while to_visit and count < MAX_PAGES:
        current_url = to_visit.popleft() # Efisiensi O(1)

        # GATEKEEPER 1: Cek Blacklist sebelum fetch (Mencegah Timeout)
        if any(blk in current_url.lower() for blk in blacklist_keywords):
            continue

        # Skip jika sudah pernah dikunjungi
        if current_url in visited_links:
            continue
        
        print(f"[{count + 1}/{MAX_PAGES}] Antrean: {len(to_visit)} | Fetching: {current_url}")
        
        try:
            # StealthyFetcher untuk nembus proteksi ITI
            page = StealthyFetcher.fetch(current_url, headless=True)
            visited_links.add(current_url)
            count += 1
            
            links = page.css("a")
            for link in links:
                href = link.attrib.get("href")
                if not href: continue
                
                # Resolving & Normalizing URL
                raw_url = urljoin(current_url, href)
                parsed = urlsplit(raw_url)
                clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                clean_url_lower = clean_url.lower()

                # Filter Sosial Media
                if any(kw in clean_url_lower for kw in sosmed_keywords):
                    link_sosmed.setdefault(current_url, set()).add(raw_url)
                
                # Filter File Manual (.pdf, .doc, dsb)
                elif any(kw in clean_url_lower for kw in manual_keywords):
                    link_manual.setdefault(current_url, set()).add(raw_url)
                
                # Filter Internal Domain (iti.ac.id)
                elif target_domain in clean_url_lower:
                    # Ambil bagian path-nya saja (tanpa domain) dan hapus slash di ujung
                    path_part = parsed.path.strip("/")
                    
                    # Logika Heuristik: Hitung jumlah strip (dash)
                    dash_count = path_part.count("-")
                    
                    # GATEKEEPER 2: Pastikan link bukan anggota blacklist & bukan artikel berita (dash <= 5)
                    is_blacklisted = any(blk in clean_url_lower for blk in blacklist_keywords)
                    
                    if not is_blacklisted and dash_count <= 5:
                        link_scraping_unique.add(clean_url)
                        link_lineage_scraping.setdefault(current_url, set()).add(clean_url)
                        
                        if clean_url not in visited_links and clean_url not in to_visit:
                            to_visit.append(clean_url)

        except Exception as e:
            print(f"   [Skip] Gagal akses {current_url}: {e}")
        
        # Etika Crawler: Beri jeda agar server kampus tidak overload
        time.sleep(2)

finally:
    print("\n[!] Shutdown terdeteksi. Mengamankan State secara Atomic...")
    
    # Fungsi Atomic Save: Mencegah file korup saat laptop mati tiba-tiba
    def atomic_save_json(data, filename):
        dir_path = os.path.dirname(os.path.abspath(filename))
        fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump({k: list(v) for k, v in data.items()}, f, indent=4)
            os.replace(tmp_path, filename)
        except Exception:
            if os.path.exists(tmp_path): os.remove(tmp_path)

    # Simpan State Utama
    with open("Daftar_File_Scraping_Massal.txt", "w", encoding="utf-8") as f:
        for u in sorted(link_scraping_unique): f.write(u + "\n")
    with open("Sisa_Antrean.txt", "w", encoding="utf-8") as f:
        for u in to_visit: f.write(u + "\n")
    with open("Sejarah_Kunjungan.txt", "w", encoding="utf-8") as f:
        for u in visited_links: f.write(u + "\n")

    # Simpan Metadata JSON
    atomic_save_json(link_lineage_scraping, "State_Lineage.json")
    atomic_save_json(link_manual, "State_Manual.json")
    atomic_save_json(link_sosmed, "State_Sosmed.json")

    # Ekspor Laporan Audit untuk Manusia
    def export_report(data, filename):
        with open(filename, "w", encoding="utf-8") as f:
            for src in sorted(data.keys()):
                f.write(f"=== SUMBER: {src} ===\n")
                for item in sorted(data[src]): f.write(f"- {item}\n")
                f.write("\n")

    export_report(link_lineage_scraping, "Audit_Lineage_Full.txt")
    export_report(link_manual, "Daftar_File_Manual.txt")
    export_report(link_sosmed, "Kontak_Sosmed.txt")
    
    print("✅ Checkpoint Aman. Misi dapat dilanjutkan kapan saja.")