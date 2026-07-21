import json
import glob
from pinecone_text.sparse import BM25Encoder

# 1. Ambil semua file JSON dari folder chunks_output
chunk_files = glob.glob("data_pipeline_embedding/chunks_output/*.json")
all_chunks = []

for f in chunk_files:
    with open(f, 'r', encoding='utf-8') as file:
        data = json.load(file)
        all_chunks.extend(data)

# 2. Ekstrak teks murni
corpus = [f"{chunk['metadata']['dokumen_asal']} - {chunk['metadata']['kategori']}\n{chunk['text']}" for chunk in all_chunks]
print(f"Total potongan teks yang dibaca: {len(corpus)}")

# 3. Latih BM25 dan Simpan Otak yang Lengkap
print("🧠 Sedang melatih BM25 dengan SELURUH data ITI...")
bm25 = BM25Encoder()
bm25.fit(corpus)
bm25.dump("bm25_params.json")
print("✅ BERHASIL! Otak BM25 versi lengkap (Ultimate) sudah tersimpan!")