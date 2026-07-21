import os
import glob
import json
import time
import hashlib
import nltk
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pinecone import Pinecone
from pinecone_text.sparse import BM25Encoder

# Perbaikan Error NLTK: Download tokenizer bahasa yang wajib untuk BM25
nltk.download('punkt_tab', quiet=True)

# ==========================================
# KONFIGURASI UTAMA
# ==========================================
MODE_DRY_RUN = False  # UBAH KE False KALAU MAU UPLOAD BENERAN KE PINECONE
BATCH_SIZE = 20
SLEEP_TIME = 2  # Istirahat 2 detik antar batch biar ga kena limit Google
START_INDEX = 0 # Ubah angka ini jika script mati di tengah jalan dan ingin Resume (Misal: 180)

# ==========================================
# 1. SETUP KREDENSIAL & CLIENT
# ==========================================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

if not GEMINI_API_KEY or not PINECONE_API_KEY or not INDEX_NAME:
    raise ValueError("❌ API Keys atau Index Name belum lengkap di file .env!")

# Inisialisasi Google Gemini Client
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Inisialisasi Pinecone Client
pc = Pinecone(api_key=PINECONE_API_KEY)
if not MODE_DRY_RUN:
    pinecone_index = pc.Index(INDEX_NAME)

# ==========================================
# 2. PENGUMPULAN DATA (CORPUS)
# ==========================================
print("📂 Mengumpulkan data dari chunks_output...")
chunk_files = glob.glob("data_pipeline_embedding/chunks_output/*.json")
all_chunks = []

for f in chunk_files:
    with open(f, 'r', encoding='utf-8') as file:
        data = json.load(file)
        all_chunks.extend(data)

if not all_chunks:
    raise ValueError("❌ Tidak ada data chunk yang ditemukan!")

print(f"✅ Berhasil memuat {len(all_chunks)} chunks.")

# ==========================================
# 3. FITTING BM25 ENCODER LOKAL (SPARSE VECTOR)
# ==========================================
# Mengajari BM25 tentang kosakata khusus ITI (Prodi, SKS, UKT)
print("🧠 Melatih BM25 Encoder dengan kosa kata ITI...")
bm25 = BM25Encoder()
corpus_texts = [f"{chunk['metadata']['dokumen_asal']} - {chunk['metadata']['kategori']}\n{chunk['text']}" for chunk in all_chunks]
bm25.fit(corpus_texts)
print("✅ BM25 siap!")

# ==========================================
# 4. FUNGSI GENERATE ID (MD5 DETERMINISTIC)
# ==========================================
def generate_id(kategori_text):
    # Membuat ID unik berdasarkan kategori (Mencegah duplikasi data)
    return hashlib.md5(kategori_text.encode('utf-8')).hexdigest()

# ==========================================
# 5. EKSEKUSI (DRY RUN ATAU PRODUCTION)
# ==========================================
def main():
    if MODE_DRY_RUN:
        print("\n" + "="*50)
        print("🚀 MENJALANKAN MODE LATIHAN (DRY RUN)")
        print("Hanya memproses 3 chunk pertama untuk sampel.")
        print("="*50)
        
        sample_chunks = all_chunks[:3]
        sample_payloads = []
        
        for chunk in sample_chunks:
            # 1. Bikin ID
            chunk_id = generate_id(chunk["metadata"]["kategori"])
            
            # 1.5 Rangkai Rich Text (Metadata + Text)
            rich_text = f"{chunk['metadata']['dokumen_asal']} - {chunk['metadata']['kategori']}\n{chunk['text']}"

            # 2. Bikin Sparse Vector (Lokal)
            sparse_vec = bm25.encode_documents(rich_text)
            
            # 3. Bikin Dense Vector (Nembak API Gemini)
            response = gemini_client.models.embed_content(
                model='gemini-embedding-2',
                contents=rich_text,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            dense_vec = response.embeddings[0].values
            
            # 4. Bungkus Payload
            payload = {
                "id": chunk_id,
                "values": dense_vec,
                "sparse_values": sparse_vec,
                "metadata": {
                    "dokumen_asal": chunk["metadata"]["dokumen_asal"],
                    "kategori": chunk["metadata"]["kategori"],
                    "text": chunk["text"]
                }
            }
            sample_payloads.append(payload)
            
        # Simpan sampel ke file JSON lokal
        with open("sample_vektor.json", "w", encoding="utf-8") as f:
            json.dump(sample_payloads, f, indent=4)
            
        print(f"✅ Selesai! Silakan lihat wujud pelurunya di file 'sample_vektor.json'.")
        print("Jika struktur sudah oke, ubah MODE_DRY_RUN = False untuk upload beneran!")

    else:
        print("\n" + "="*50)
        print("🔥 MENJALANKAN MODE PERANG (PRODUCTION UPLOAD)")
        print(f"Melanjutkan unggahan dari chunk ke-{START_INDEX + 1}...")
        print("="*50)
        
        # Batching Algorithm
        for i in range(START_INDEX, len(all_chunks), BATCH_SIZE):
            batch = all_chunks[i:i+BATCH_SIZE]
            batch_payloads = []
            
            try:
                print(f"⚙️ Memproses Batch {i//BATCH_SIZE + 1} (Chunk {i+1} - {i+len(batch)})...")
                
                # Rakit peluru masing-masing chunk dalam batch
                for chunk in batch:
                    chunk_id = generate_id(chunk["metadata"]["kategori"])
                    rich_text = f"{chunk['metadata']['dokumen_asal']} - {chunk['metadata']['kategori']}\n{chunk['text']}"
                    sparse_vec = bm25.encode_documents(rich_text)
                    
                    # Nembak Gemini satu per satu
                    gemini_resp = gemini_client.models.embed_content(
                        model='gemini-embedding-2',
                        contents=rich_text,
                        config=types.EmbedContentConfig(output_dimensionality=768)
                    )
                    dense_vec = gemini_resp.embeddings[0].values
                    
                    batch_payloads.append({
                        "id": chunk_id,
                        "values": dense_vec,
                        "sparse_values": sparse_vec,
                        "metadata": {
                            "dokumen_asal": chunk["metadata"]["dokumen_asal"],
                            "kategori": chunk["metadata"]["kategori"],
                            "text": chunk["text"]
                        }
                    })
                
                # Tembak ke Pinecone Database
                pinecone_index.upsert(vectors=batch_payloads)
                print("   ✅ Berhasil diunggah!")
                
                # Istirahat biar ga ditilang API Limit
                time.sleep(SLEEP_TIME)

                
            except Exception as e:
                print(f"   ❌ GAGAL PADA BATCH {i//BATCH_SIZE + 1}: {e}")
                print("   Skrip berhenti untuk mencegah kehilangan data.")
                break
                
        print("\n✅ Misi Selesai!")

if __name__ == "__main__":
    main()
