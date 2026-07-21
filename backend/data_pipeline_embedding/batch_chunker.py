import os
import glob
import json
from text_splitter import HierarchicalTextSplitter

def main():
    # 1. Konfigurasi Path (Asumsi script dijalankan dari dalam folder backend/)
    input_folder = "../Scrapling_data/data_unstructured"
    output_folder = "chunks_output"
    
    # Buat folder output jika belum ada
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"📁 Folder '{output_folder}' berhasil dibuat.")

    # 2. Cari semua file .docx di folder input (Abaikan file temporary yang berawalan ~$)
    search_pattern = os.path.join(input_folder, "*.docx")
    all_docx_files = glob.glob(search_pattern)
    
    valid_docx_files = [f for f in all_docx_files if not os.path.basename(f).startswith("~$")]
    
    if not valid_docx_files:
        print(f"❌ Tidak ada file .docx valid ditemukan di {input_folder}")
        return

    print(f"🔍 Ditemukan {len(valid_docx_files)} dokumen untuk digiling. Memulai proses Batching...\n")

    # 3. Inisialisasi Mesin Pemotong (3000 Karakter, Pemotongan Semantik)
    splitter = HierarchicalTextSplitter(max_chunk_length=3000)
    
    sukses_count = 0
    error_count = 0

    # 4. Looping Eksekusi (O(n) complexity terhadap jumlah file)
    for file_path in valid_docx_files:
        filename = os.path.basename(file_path)
        base_name = os.path.splitext(filename)[0] # Hilangkan ekstensi .docx
        output_filename = f"chunk_{base_name}.json"
        output_filepath = os.path.join(output_folder, output_filename)
        
        try:
            print(f"⚙️ Memproses: {filename}...")
            
            # Panggil fungsi dari class HierarchicalTextSplitter
            hasil_chunks = splitter.parse_docx(file_path)
            
            # Tulis ke file JSON terpisah (OPSI B)
            with open(output_filepath, 'w', encoding='utf-8') as f:
                json.dump(hasil_chunks, f, ensure_ascii=False, indent=4)
                
            print(f"   ✅ Selesai! Menghasilkan {len(hasil_chunks)} chunks -> {output_filename}")
            sukses_count += 1
            
        except Exception as e:
            print(f"   ❌ GAGAL memproses {filename}: {e}")
            error_count += 1

    # 5. Laporan Eksekusi
    print("\n" + "="*40)
    print("📊 LAPORAN BATCH CHUNKING")
    print("="*40)
    print(f"Total Dokumen : {len(valid_docx_files)}")
    print(f"Berhasil      : {sukses_count}")
    print(f"Gagal         : {error_count}")
    print(f"Folder Output : {os.path.abspath(output_folder)}")
    print("="*40)

if __name__ == "__main__":
    main()
