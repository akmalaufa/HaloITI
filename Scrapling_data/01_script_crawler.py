from scrapling import StealthyFetcher
from urllib.parse import urljoin
import time

print("Memulai inisiasi script crawler...")
print("Target utama: Domain iti.ac.id")

target_domain = "iti.ac.id"

# Titik awal crawling
start_urls = [
    "https://iti.ac.id/",
    "https://pmb.iti.ac.id/",
    "https://if.iti.ac.id/",
    "https://sipil.iti.ac.id/",
    "https://mesin.iti.ac.id/",
    "https://industri.iti.ac.id/",
    "https://tekim.iti.ac.id/",
    "https://el.iti.ac.id/",
    "https://ars.iti.ac.id/",
    "https://pwk.iti.ac.id/",
    "https://tip.iti.ac.id/",
    "https://mn.iti.ac.id/",
    "https://psppi.iti.ac.id/",
    "https://rpl.iti.ac.id/",
    "https://mbkm.iti.ac.id/",
    "https://pka.iti.ac.id/",
    "https://ppa.iti.ac.id/",
    "https://ulds.iti.ac.id/",
    "https://prpm.iti.ac.id/",
    "https://library.iti.ac.id/",
    "https://pdsi.iti.ac.id/"
]

to_visit = start_urls.copy()
visited_links = set()

# Penyimpanan output
link_scraping = set()
link_manual = set()
link_sosmed = set()

# Konfigurasi filter
sosmed_keywords = ["instagram.com", "facebook.com", "twitter.com", "x.com", "wa.me", "youtube.com", "tiktok.com", "linkedin.com"]
manual_keywords = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", "docs.google.com", "forms.google.com", "drive.google.com"]

# Daftar URL yang diabaikan (Blacklist)
blacklist_keywords = [
    "siakad.iti.ac.id", 
    "jurnaliptek.iti.ac.id", 
    "helpdesk.iti.ac.id", 
    "webmail.iti.ac.id"
]

# Batas maksimal crawling
MAX_PAGES = 1000 
count = 0

try:
    while to_visit and count < MAX_PAGES:
        current_url = to_visit.pop(0)
        
        if current_url in visited_links:
            continue
            
        print(f"[{count + 1}/{MAX_PAGES}] Proses fetch URL: {current_url}")
        visited_links.add(current_url)
        count += 1
        
        try:
            page = StealthyFetcher.fetch(current_url, headless=True)
            links = page.css("a")
            
            for link in links:
                href = link.attrib.get("href")
                if not href:
                    continue
                    
                full_url = urljoin(current_url, href)
                full_url_lower = full_url.lower()

                # Filter Sosial Media
                if any(keyword in full_url_lower for keyword in sosmed_keywords):
                    link_sosmed.add(full_url)
                
                # Filter File Manual
                elif any(keyword in full_url_lower for keyword in manual_keywords):
                    link_manual.add(full_url)
                
                # Filter Scraping ITI & Blacklist Check
                elif target_domain in full_url_lower:
                    # Pastikan link tidak mengandung kata yang ada di blacklist
                    is_blacklisted = any(black_kw in full_url_lower for black_kw in blacklist_keywords)
                    
                    if not is_blacklisted:
                        link_scraping.add(full_url)
                        
                        if full_url not in visited_links and full_url not in to_visit:
                            to_visit.append(full_url)
                        
        except Exception as inner_e:
            print(f"   [Skip] Gagal memuat halaman, alasan: {inner_e}")
        
        # Jeda antar request
        time.sleep(2)

    # Proses simpan file
    print("\nMenyimpan hasil crawling ke file text...")
    
    with open("Daftar_File_Scraping.txt", "w", encoding="utf-8") as f:
        for url in sorted(link_scraping):
            f.write(url + "\n")
            
    with open("Daftar_File_Manual.txt", "w", encoding="utf-8") as f:
        for url in sorted(link_manual):
            f.write(url + "\n")
            
    with open("Kontak_Sosmed.txt", "w", encoding="utf-8") as f:
        for url in sorted(link_sosmed):
            f.write(url + "\n")

    # Laporan akhir
    print("\n=== REKAPITULASI CRAWLING ===")
    print(f"Status: Selesai")
    print(f"Total antrean berhasil di-scrape: {len(link_scraping)} link")
    
    sisa_antrean = len(to_visit)
    if sisa_antrean > 0:
        print(f"Info: Batas maksimal halaman terpenuhi ({MAX_PAGES}).")
        print(f"Sisa antrean URL yang belum diproses: {sisa_antrean}")
    else:
        print("Info: Seluruh antrean URL telah diproses (0 sisa).")
        print("Cakupan domain berhasil dipetakan sepenuhnya.")

except Exception as e:
    print(f"\n[Error] Terjadi kesalahan sistem: {e}")